
const express = require("express");
const cors = require("cors");

const app = express();
const PORT = 3000;


app.use(cors());

app.use(express.json());

app.get("/", (req, res) => {
    res.send("¡Bienvenido al backend de Nexiuma!");
});


app.post("/api/contacto", (req, res) => {

    const { nombre, email, whatsapp, profesion, mensaje } = req.body;

    if (!nombre || !email || !whatsapp || !mensaje) {
        return res.status(400).json({
            mensaje: "Por favor, completá todos los campos obligatorios."
        });
    }


    console.log("Nueva consulta recibida:");
    console.log("Nombre:", nombre);
    console.log("Email:", email);
    console.log("WhatsApp:", whatsapp);
    console.log("Profesión:", profesion);
    console.log("Mensaje:", mensaje);

    
    res.status(200).json({
        mensaje: "¡Recibimos tus datos! En breve nos comunicaremos contigo."
    });

});



app.listen(PORT, () => {
    console.log(`Servidor de Nexiuma funcionando en http://localhost:${PORT}`);
});
