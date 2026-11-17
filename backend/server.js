
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const { MongoClient } = require("mongodb");

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

const cliente = new MongoClient(process.env.MONGODB_URI);
let coleccionConsultas;

app.get("/", (req, res) => {
    res.send("Backend de Nexiuma funcionando");
});

// Recibir consultas del formulario
app.post("/api/contacto", async (req, res) => {
    const { nombre, email, whatsapp, profesion, mensaje } = req.body;

    if (!nombre || !email || !whatsapp || !mensaje) {
        return res.status(400).json({
            mensaje: "Completá los campos obligatorios."
        });
    }

    try {
        const nuevaConsulta = {
            nombre,
            email,
            whatsapp,
            profesion: profesion || "",
            mensaje,
            fecha: new Date()
        };

        const resultado = await coleccionConsultas.insertOne(nuevaConsulta);

        console.log("CONSULTA GUARDADA:", resultado.insertedId);

        res.status(201).json({
            mensaje: "¡Recibimos tus datos! Tu consulta quedó guardada correctamente."
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({
            mensaje: "No pudimos guardar tu consulta."
        });
    }
});

// Inicio de sesión del administrador
app.post("/api/admin/login", (req, res) => {
    const { password } = req.body;
    console.log("ENTRÓ A LA RUTA DE LOGIN");

    if (password !== process.env.ADMIN_PASSWORD) {
        return res.status(401).json({
            mensaje: "Contraseña incorrecta."
        });
    }

    res.json({
        token: process.env.ADMIN_TOKEN
    });
});

// Obtener consultas: solo administrador
app.get("/api/admin/consultas", async (req, res) => {
    const token = req.headers.authorization;

    if (token !== `Bearer ${process.env.ADMIN_TOKEN}`) {
        return res.status(401).json({
            mensaje: "Acceso no autorizado."
        });
    }

    try {
        const consultas = await coleccionConsultas
            .find({})
            .sort({ fecha: -1 })
            .limit(100)
            .toArray();

        res.json(consultas);

    } catch (error) {
        console.error(error);
        res.status(500).json({
            mensaje: "Error al cargar las consultas."
        });
    }
});

async function iniciarServidor() {
    try {
        if (!process.env.MONGODB_URI) {
            throw new Error("Falta MONGODB_URI en .env");
        }

        if (!process.env.ADMIN_PASSWORD || !process.env.ADMIN_TOKEN) {
            throw new Error("Faltan las claves del administrador en .env");
        }

        await cliente.connect();

        const baseDatos = cliente.db("nexiuma");
        coleccionConsultas = baseDatos.collection("consultas");

        console.log("Conexión con MongoDB exitosa");

        app.listen(PORT, () => {
            console.log(`Servidor funcionando en http://localhost:${PORT}`);
        });

    } catch (error) {
        console.error("Error al iniciar:", error);
        process.exit(1);
    }
}

iniciarServidor();
