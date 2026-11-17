
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const { MongoClient } = require("mongodb");

const app = express();
const PORT = 3001;

// Configuración del servidor
app.use(cors());
app.use(express.json());

// Conexión con MongoDB
const cliente = new MongoClient(process.env.MONGODB_URI);

let coleccionConsultas;

// Página principal
app.get("/", (req, res) => {
    res.send("¡Bienvenido al backend de Nexiuma!");
});

// Formulario de contacto
app.post("/api/contacto", async (req, res) => {
    console.log("📩 LLEGÓ UNA CONSULTA AL SERVIDOR");

    try {
        const { nombre, email, whatsapp, profesion, mensaje } = req.body;

        if (!nombre || !email || !whatsapp || !mensaje) {
            return res.status(400).json({
                mensaje: "Faltan datos obligatorios."
            });
        }

        const consulta = {
            nombre,
            email,
            whatsapp,
            profesion: profesion || "",
            mensaje,
            fecha: new Date()
        };

        const resultado = await coleccionConsultas.insertOne(consulta);

        console.log("✅ CONSULTA GUARDADA EN MONGODB");
        console.log("ID:", resultado.insertedId);

        res.status(201).json({
            mensaje: "Consulta guardada correctamente en Nexiuma.",
            guardado: true
        });

    } catch (error) {
        console.error("❌ ERROR AL GUARDAR:", error);

        res.status(500).json({
            mensaje: "Error al guardar en MongoDB.",
            guardado: false
        });
    }
});


// Conectar la base de datos e iniciar el servidor
async function iniciarServidor() {

    try {
        if (!process.env.MONGODB_URI) {
            throw new Error("No se encontró la variable MONGODB_URI en el archivo .env");
        }

        await cliente.connect();

        const baseDatos = cliente.db("nexiuma");

        coleccionConsultas = baseDatos.collection("consultas");

        console.log("¡Conexión con MongoDB exitosa!");

        app.listen(PORT, () => {
            console.log(`Servidor de Nexiuma funcionando en http://localhost:${PORT}`);
        });

    } catch (error) {
        console.error("Error al iniciar Nexiuma:", error);
        process.exit(1);
    }
}

iniciarServidor();
