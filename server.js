// Servidor Express con conexión a MySQL para la App de rec_paciente
const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');
const dotenv = require('dotenv');
const bodyParser = require('body-parser');

// Cargar variables de entorno
dotenv.config();

const app = express();
const PORT = process.env.PORT || 8000;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Configuración de la conexión a MySQL
const dbConfig = {
    host: process.env.DB_HOST || 'srv1597.hstgr.io',
    user: process.env.DB_USER || 'u565673608_AltaLuna',
    password: process.env.DB_PASSWORD || '!w6CLEt7:',
    database: process.env.DB_NAME || 'u565673608_AltaLuna',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
};

// Pool de conexiones MySQL
const pool = mysql.createPool(dbConfig);

// Middleware para verificar la conexión a la base de datos
app.use(async (req, res, next) => {
    try {
        // Agregar conexión a req para usar en rutas
        req.db = await pool.getConnection();
        req.db.release(); // Liberar inmediatamente
        next();
    } catch (error) {
        console.error('Error al conectar con la base de datos:', error);
        res.status(500).json({
            error: 'Error de conexión a la base de datos',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// Ruta de prueba
app.get('/', (req, res) => {
    res.json({ message: 'API del servidor de Pacientes funcionando correctamente' });
});

// Verificar paciente por DNI
app.get('/api/patients/check/:dni', async (req, res) => {
    const { dni } = req.params;
    let connection;

    try {
        connection = await pool.getConnection();

        // Consulta SQL para buscar un paciente por DNI
        const [rows] = await connection.execute(
            'SELECT * FROM rec_paciente WHERE dni = ?',
            [dni]
        );

        if (rows.length > 0) {
            res.json({
                exists: true,
                patient: rows[0]
            });
        } else {
            res.json({
                exists: false
            });
        }
    } catch (error) {
        console.error('Error al verificar paciente por DNI:', error);
        res.status(500).json({
            error: 'Error al verificar el paciente',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    } finally {
        if (connection) connection.release();
    }
});

// Registrar nuevo paciente
app.post('/api/patients', async (req, res) => {
    let connection;

    try {
        connection = await pool.getConnection();

        // Validar datos mínimos requeridos
        const { dni, nombre, apellido, sexo } = req.body;

        if (!dni || !nombre || !apellido || !sexo) {
            return res.status(400).json({
                error: 'Faltan datos obligatorios (dni, nombre, apellido, sexo)'
            });
        }

        // Verificar si ya existe un paciente con ese DNI
        const [existingPatients] = await connection.execute(
            'SELECT * FROM rec_paciente WHERE dni = ?',
            [dni]
        );

        if (existingPatients.length > 0) {
            return res.status(409).json({
                error: 'Ya existe un paciente con ese DNI'
            });
        }

        // Preparar la consulta SQL para insertar un nuevo paciente
        // Construir dinámicamente la consulta basada en los campos proporcionados
        const fields = Object.keys(req.body);
        const values = Object.values(req.body);
        const placeholders = fields.map(() => '?').join(', ');

        const query = `INSERT INTO rec_paciente (${fields.join(', ')}) VALUES (${placeholders})`;

        // Ejecutar la consulta
        const [result] = await connection.execute(query, values);

        // Obtener el paciente recién creado
        const [newPatient] = await connection.execute(
            'SELECT * FROM rec_paciente WHERE id = ?',
            [result.insertId]
        );

        res.status(201).json({
            success: true,
            patient: newPatient[0]
        });
    } catch (error) {
        console.error('Error al registrar paciente:', error);
        res.status(500).json({
            error: 'Error al registrar el paciente',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    } finally {
        if (connection) connection.release();
    }
});

// Actualizar paciente
app.put('/api/patients/:id', async (req, res) => {
    const { id } = req.params;
    let connection;

    try {
        connection = await pool.getConnection();

        // Verificar si el paciente existe
        const [existingPatients] = await connection.execute(
            'SELECT * FROM rec_paciente WHERE id = ?',
            [id]
        );

        if (existingPatients.length === 0) {
            return res.status(404).json({
                error: 'Paciente no encontrado'
            });
        }

        // Filtrar campos permitidos para actualizar (evitar modificar campos críticos)
        const allowedFields = [
            'email', 'telefono', 'calle', 'numero', 'piso', 'departamento',
            'cpostal', 'barrio', 'ciudad', 'provincia', 'peso', 'talla'
        ];

        const updateData = {};

        for (const field of allowedFields) {
            if (req.body[field] !== undefined) {
                updateData[field] = req.body[field];
            }
        }

        // Si no hay campos para actualizar
        if (Object.keys(updateData).length === 0) {
            return res.status(400).json({
                error: 'No se proporcionaron campos válidos para actualizar'
            });
        }

        // Construir la consulta de actualización
        const setClause = Object.keys(updateData)
            .map(field => `${field} = ?`)
            .join(', ');

        const values = [...Object.values(updateData), id];

        const query = `UPDATE rec_paciente SET ${setClause} WHERE id = ?`;

        // Ejecutar la consulta
        await connection.execute(query, values);

        // Obtener el paciente actualizado
        const [updatedPatient] = await connection.execute(
            'SELECT * FROM rec_paciente WHERE id = ?',
            [id]
        );

        res.json({
            success: true,
            patient: updatedPatient[0]
        });
    } catch (error) {
        console.error('Error al actualizar paciente:', error);
        res.status(500).json({
            error: 'Error al actualizar el paciente',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    } finally {
        if (connection) connection.release();
    }
});

// Obtener próximas citas médicas del paciente (endpoint de ejemplo para futuras funcionalidades)
app.get('/api/patients/:id/appointments', async (req, res) => {
    const { id } = req.params;

    // Este es un endpoint placeholder para la funcionalidad futura
    res.json({
        message: 'Funcionalidad de citas médicas en desarrollo',
        appointments: []
    });
});

// Obtener recetas médicas del paciente (endpoint de ejemplo para futuras funcionalidades)
app.get('/api/patients/:id/prescriptions', async (req, res) => {
    const { id } = req.params;

    // Este es un endpoint placeholder para la funcionalidad futura
    res.json({
        message: 'Funcionalidad de recetas médicas en desarrollo',
        prescriptions: []
    });
});

// Obtener estudios médicos del paciente (endpoint de ejemplo para futuras funcionalidades)
app.get('/api/patients/:id/medical-tests', async (req, res) => {
    const { id } = req.params;

    // Este es un endpoint placeholder para la funcionalidad futura
    res.json({
        message: 'Funcionalidad de estudios médicos en desarrollo',
        medicalTests: []
    });
});

// Middleware para manejo de errores
app.use((err, req, res, next) => {
    console.error('Error no manejado:', err);
    res.status(500).json({
        error: 'Error interno del servidor',
        details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

// Iniciar el servidor
app.listen(PORT, () => {
    console.log(`Servidor ejecutándose en http://localhost:${PORT}`);
});