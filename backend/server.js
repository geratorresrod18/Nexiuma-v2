require("dotenv").config();

const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { MongoClient, ObjectId } = require("mongodb");

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

app.use((req, res, next) => {
    console.log("SOLICITUD RECIBIDA:", req.method, req.url);
    next();
});

const cliente = new MongoClient(process.env.MONGODB_URI);

let consultas, reservas, servicios, negocios, usuarios;

const catalogoInicial = [
    {
        categoria: "Manos",
        servicios: [
            { nombre: "Manicura", duracion: 60, precio: 0, sena: 0, descripcion: "" },
            { nombre: "Kapping", duracion: 90, precio: 0, sena: 0, descripcion: "" },
            { nombre: "Polygel", duracion: 120, precio: 0, sena: 0, descripcion: "" }
        ]
    },
    {
        categoria: "Pies",
        servicios: [
            { nombre: "Pedicura", duracion: 60, precio: 0, sena: 0, descripcion: "" }
        ]
    }
];

const horarioInicial = {
    lunes: { activo: true, inicio: "09:00", fin: "17:00", descansoInicio: "", descansoFin: "" },
    martes: { activo: true, inicio: "09:00", fin: "17:00", descansoInicio: "", descansoFin: "" },
    miercoles: { activo: true, inicio: "09:00", fin: "17:00", descansoInicio: "", descansoFin: "" },
    jueves: { activo: true, inicio: "09:00", fin: "17:00", descansoInicio: "", descansoFin: "" },
    viernes: { activo: true, inicio: "09:00", fin: "17:00", descansoInicio: "", descansoFin: "" },
    sabado: { activo: true, inicio: "09:00", fin: "13:00", descansoInicio: "", descansoFin: "" },
    domingo: { activo: false, inicio: "09:00", fin: "17:00", descansoInicio: "", descansoFin: "" }
};

const dias = ["domingo", "lunes", "martes", "miercoles", "jueves", "viernes", "sabado"];

function fechaValida(fecha) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha || "")) return false;
    const [a, m, d] = fecha.split("-").map(Number);
    const f = new Date(a, m - 1, d);
    return f.getFullYear() === a && f.getMonth() === m - 1 && f.getDate() === d;
}

function minutos(hora) {
    if (!/^\d{2}:\d{2}$/.test(hora || "")) return null;
    const [h, m] = hora.split(":").map(Number);
    if (h > 23 || m > 59) return null;
    return h * 60 + m;
}

function hora(min) {
    return `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
}

function superpone(a, b, c, d) {
    return a < d && c < b;
}

function crearSlug(nombre) {
    return nombre
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
}

function crearToken(usuario) {
    return jwt.sign(
        {
            id: usuario._id.toString(),
            profesional: usuario.profesional,
            email: usuario.email
        },
        process.env.JWT_SECRET,
        { expiresIn: "7d" }
    );
}

// PROTEGER LAS RUTAS PRIVADAS
function autenticar(req, res, next) {
    const encabezado = req.headers.authorization || "";
    const token = encabezado.startsWith("Bearer ")
        ? encabezado.slice(7)
        : "";

    if (!token) {
        return res.status(401).json({ mensaje: "Iniciá sesión para continuar." });
    }

    try {
        const datos = jwt.verify(token, process.env.JWT_SECRET);
        req.usuario = datos;
        next();
    } catch {
        return res.status(401).json({ mensaje: "Tu sesión venció. Iniciá sesión nuevamente." });
    }
}

function profesionalActual(req) {
    return req.usuario.profesional;
}

async function obtenerNegocio(profesional) {
    return await negocios.findOne({ profesional }) || {
        profesional,
        nombre: profesional === "bellissima-nails-by-gera" ? "Bellissima Nails by Gera" : "",
        rubro: "",
        telefono: "",
        whatsapp: "",
        direccion: "",
        descripcion: "",
        logo: "",
        horarios: horarioInicial
    };
}

async function obtenerCatalogo(profesional) {
    const guardado = await servicios.findOne({ profesional });
    return guardado?.categorias || catalogoInicial;
}

function buscarServicio(categorias, nombre) {
    for (const categoria of categorias) {
        const encontrado = (categoria.servicios || []).find(s => s.nombre === nombre);
        if (encontrado) return encontrado;
    }
    return null;
}

function calcularRango(r) {
    const inicio = Number.isInteger(r.inicioMinutos) ? r.inicioMinutos : minutos(r.hora);
    return { inicio, fin: inicio + (Number(r.duracion) || 60) };
}


// REGISTRO DE USUARIOS
app.post("/api/auth/registro", async (req, res) => {
    try {
        const nombre = String(req.body.nombre || "").trim();
        const email = String(req.body.email || "").trim().toLowerCase();
        const password = String(req.body.password || "");

        if (!nombre || !email || !password) {
            return res.status(400).json({
                mensaje: "Completá todos los campos."
            });
        }

        const emailValido = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        if (!emailValido.test(email)) {
            return res.status(400).json({
                mensaje: "Ingresá un correo electrónico válido."
            });
        }

        if (password.length < 8) {
            return res.status(400).json({
                mensaje: "La contraseña debe tener al menos 8 caracteres."
            });
        }

        const cantidadUsuarios = await usuarios.countDocuments({});

        if (
            cantidadUsuarios === 0 &&
            process.env.OWNER_EMAIL &&
            email !== process.env.OWNER_EMAIL.trim().toLowerCase()
        ) {
            return res.status(403).json({
                mensaje: "El primer registro está reservado para la cuenta propietaria de Nexiuma."
            });
        }

        if (await usuarios.findOne({ email })) {
            return res.status(409).json({
                mensaje: "Ese correo ya tiene una cuenta. Iniciá sesión."
            });
        }

        const baseSlug = crearSlug(nombre);

        if (!baseSlug) {
            return res.status(400).json({
                mensaje: "Ingresá un nombre válido para tu negocio."
            });
        }

        let profesional = baseSlug;
        let numero = 2;

        while (await usuarios.findOne({ profesional })) {
            profesional = `${baseSlug}-${numero++}`;
        }

        const hash = await bcrypt.hash(password, 12);

        const nuevoUsuario = {
            nombre,
            email,
            password: hash,
            profesional,
            fechaCreacion: new Date()
        };

        const resultado = await usuarios.insertOne(nuevoUsuario);
        nuevoUsuario._id = resultado.insertedId;

        await negocios.updateOne(
            { profesional },
            {
                $setOnInsert: {
                    profesional,
                    nombre,
                    rubro: "",
                    telefono: "",
                    whatsapp: "",
                    direccion: "",
                    descripcion: "",
                    logo: "",
                    horarios: horarioInicial
                }
            },
            { upsert: true }
        );

        res.status(201).json({
            mensaje: "¡Tu cuenta fue creada!",
            token: crearToken(nuevoUsuario),
            profesional,
            nombre
        });

    } catch (error) {
        console.error("ERROR REGISTRO:", error);

        res.status(500).json({
            mensaje: "No pudimos crear tu cuenta."
        });
    }
});

// INICIAR SESIÓN
app.post("/api/auth/login", async (req, res) => {
    try {
        const email = String(req.body.email || "").trim().toLowerCase();
        const password = String(req.body.password || "");

        if (!email || !password) {
            return res.status(400).json({ mensaje: "Ingresá tu correo y contraseña." });
        }

        const usuario = await usuarios.findOne({ email });

        if (!usuario || !(await bcrypt.compare(password, usuario.password))) {
            return res.status(401).json({ mensaje: "Correo o contraseña incorrectos." });
        }

        res.json({
            mensaje: "Sesión iniciada correctamente.",
            token: crearToken(usuario),
            profesional: usuario.profesional,
            nombre: usuario.nombre
        });

    } catch (e) {
        console.error("ERROR LOGIN:", e);
        res.status(500).json({ mensaje: "No pudimos iniciar sesión." });
    }
});

// DATOS DE LA SESIÓN
app.get("/api/auth/me", autenticar, async (req, res) => {
    const usuario = await usuarios.findOne(
        { _id: new ObjectId(req.usuario.id) },
        { projection: { password: 0 } }
    );

    if (!usuario) {
        return res.status(404).json({ mensaje: "No encontramos tu cuenta." });
    }

    res.json({
        nombre: usuario.nombre,
        email: usuario.email,
        profesional: usuario.profesional
    });
});

// CONTACTO
app.post("/api/contacto", async (req, res) => {
    try {
        const { nombre, email, whatsapp, profesion, mensaje } = req.body;

        if (!nombre || !email || !whatsapp || !mensaje) {
            return res.status(400).json({ mensaje: "Completá los campos obligatorios." });
        }

        await consultas.insertOne({
            nombre, email, whatsapp, profesion, mensaje, fecha: new Date()
        });

        res.status(201).json({ mensaje: "Consulta guardada correctamente." });

    } catch (e) {
        console.error(e);
        res.status(500).json({ mensaje: "No pudimos guardar la consulta." });
    }
});

// LOGIN ADMIN
app.post("/api/admin/login", (req, res) => {
    if (req.body.password !== process.env.ADMIN_PASSWORD) {
        return res.status(401).json({ mensaje: "Contraseña incorrecta." });
    }
    res.json({ token: process.env.ADMIN_TOKEN });
});

app.get("/api/admin/consultas", async (req, res) => {
    if (req.headers.authorization !== `Bearer ${process.env.ADMIN_TOKEN}`) {
        return res.status(401).json({ mensaje: "Acceso no autorizado." });
    }

    try {
        res.json(await consultas.find({}).sort({ fecha: -1 }).limit(100).toArray());
    } catch {
        res.status(500).json({ mensaje: "Error al cargar consultas." });
    }
});

// CONFIGURACIÓN DEL NEGOCIO
app.get("/api/profesional/configuracion", autenticar, async (req, res) => {
    try {
        res.json(await obtenerNegocio(profesionalActual(req)));
    } catch (e) {
        console.error(e);
        res.status(500).json({ mensaje: "No pudimos cargar la configuración." });
    }
});

app.put("/api/profesional/configuracion", autenticar, async (req, res) => {
    const profesional = profesionalActual(req);
    const campos = ["nombre", "rubro", "telefono", "whatsapp", "direccion", "descripcion", "logo"];
    const datos = {};

    campos.forEach(c => {
        datos[c] = String(req.body[c] || "").trim();
    });

    try {
        await negocios.updateOne(
            { profesional },
            { $set: { ...datos, actualizado: new Date() }, $setOnInsert: { profesional } },
            { upsert: true }
        );

        res.json({ mensaje: "Datos del negocio guardados." });

    } catch (e) {
        console.error(e);
        res.status(500).json({ mensaje: "No pudimos guardar los datos." });
    }
});

// HORARIOS
app.get("/api/profesional/horarios", autenticar, async (req, res) => {
    try {
        const negocio = await obtenerNegocio(profesionalActual(req));
        res.json(negocio.horarios || horarioInicial);
    } catch {
        res.status(500).json({ mensaje: "No pudimos cargar los horarios." });
    }
});

app.put("/api/profesional/horarios", autenticar, async (req, res) => {
    const profesional = profesionalActual(req);
    const horarios = req.body.horarios;

    if (!horarios) {
        return res.status(400).json({ mensaje: "Faltan los horarios." });
    }

    for (const dia of dias) {
        const h = horarios[dia];

        if (!h) {
            return res.status(400).json({ mensaje: `Faltan los horarios de ${dia}.` });
        }

        if (
            h.activo &&
            (minutos(h.inicio) === null ||
                minutos(h.fin) === null ||
                minutos(h.inicio) >= minutos(h.fin))
        ) {
            return res.status(400).json({ mensaje: `Revisá el horario de ${dia}.` });
        }

        if (h.descansoInicio || h.descansoFin) {
            if (
                minutos(h.descansoInicio) === null ||
                minutos(h.descansoFin) === null ||
                minutos(h.descansoInicio) >= minutos(h.descansoFin) ||
                minutos(h.descansoInicio) < minutos(h.inicio) ||
                minutos(h.descansoFin) > minutos(h.fin)
            ) {
                return res.status(400).json({ mensaje: `Revisá el descanso de ${dia}.` });
            }
        }
    }

    try {
        await negocios.updateOne(
            { profesional },
            { $set: { horarios, actualizado: new Date() }, $setOnInsert: { profesional } },
            { upsert: true }
        );

        res.json({ mensaje: "Horarios guardados correctamente." });

    } catch (e) {
        console.error(e);
        res.status(500).json({ mensaje: "No pudimos guardar los horarios." });
    }
});

// CATÁLOGO PÚBLICO
app.get("/api/reservas/catalogo", async (req, res) => {
    const profesional = String(req.query.profesional || "").trim();

    if (!profesional) {
        return res.status(400).json({ mensaje: "Falta el profesional." });
    }

    try {
        res.json({ profesional, categorias: await obtenerCatalogo(profesional) });
    } catch {
        res.status(500).json({ mensaje: "No pudimos cargar los servicios." });
    }
});

// SERVICIOS PRIVADOS
app.get("/api/profesional/servicios", autenticar, async (req, res) => {
    try {
        res.json(await obtenerCatalogo(profesionalActual(req)));
    } catch {
        res.status(500).json({ mensaje: "No pudimos cargar los servicios." });
    }
});

app.put("/api/profesional/servicios", autenticar, async (req, res) => {
    const profesional = profesionalActual(req);
    const categorias = req.body.categorias;

    if (!Array.isArray(categorias)) {
        return res.status(400).json({ mensaje: "Faltan los datos de los servicios." });
    }

    for (const cat of categorias) {
        if (!cat.categoria || !Array.isArray(cat.servicios)) {
            return res.status(400).json({ mensaje: "Revisá las categorías y sus servicios." });
        }

        for (const s of cat.servicios) {
            if (
                !s.nombre ||
                !Number(s.duracion) ||
                Number(s.duracion) < 15 ||
                Number(s.precio) < 0 ||
                Number(s.sena) < 0
            ) {
                return res.status(400).json({
                    mensaje: "Revisá el nombre, duración, precio y seña de cada servicio."
                });
            }
        }
    }

    try {
        await servicios.updateOne(
            { profesional },
            { $set: { categorias, actualizado: new Date() }, $setOnInsert: { profesional } },
            { upsert: true }
        );

        res.json({ mensaje: "Servicios guardados correctamente." });

    } catch (e) {
        console.error(e);
        res.status(500).json({ mensaje: "No pudimos guardar los servicios." });
    }
});

// HORARIOS DISPONIBLES PARA CLIENTES
app.get("/api/reservas/disponibles", async (req, res) => {
    const profesional = String(req.query.profesional || "").trim();
    const fecha = String(req.query.fecha || "").trim();
    const nombreServicio = String(req.query.servicio || "").trim();

    if (!profesional || !fecha || !nombreServicio || !fechaValida(fecha)) {
        return res.status(400).json({ mensaje: "Los datos para consultar horarios no son válidos." });
    }

    try {
        const negocio = await obtenerNegocio(profesional);
        const configuracionDia = negocio.horarios?.[dias[new Date(`${fecha}T12:00:00`).getDay()]];

        if (!configuracionDia?.activo) return res.json({ horarios: [] });

        const categorias = await obtenerCatalogo(profesional);
        const servicio = buscarServicio(categorias, nombreServicio);

        if (!servicio) {
            return res.status(404).json({ mensaje: "No encontramos ese servicio." });
        }

        const duracion = Number(servicio.duracion) || 60;
        const apertura = minutos(configuracionDia.inicio);
        const cierre = minutos(configuracionDia.fin);
        const descansoA = configuracionDia.descansoInicio
            ? minutos(configuracionDia.descansoInicio)
            : null;
        const descansoB = configuracionDia.descansoFin
            ? minutos(configuracionDia.descansoFin)
            : null;

        const ocupadas = await reservas.find({
            profesional,
            fecha,
            estado: { $ne: "cancelada" }
        }).toArray();

        const horarios = [];

        for (let inicio = apertura; inicio + duracion <= cierre; inicio += 30) {
            const fin = inicio + duracion;
            const chocaDescanso =
                descansoA !== null && superpone(inicio, fin, descansoA, descansoB);

            const chocaTurno = ocupadas.some(r => {
                const rango = calcularRango(r);
                return superpone(inicio, fin, rango.inicio, rango.fin);
            });

            if (!chocaDescanso && !chocaTurno) horarios.push(hora(inicio));
        }

        res.json({ horarios, duracion });

    } catch (e) {
        console.error(e);
        res.status(500).json({ mensaje: "No pudimos consultar los horarios." });
    }
});

// CREAR RESERVA PÚBLICA
app.post("/api/reservas", async (req, res) => {
    const profesional = String(req.body.profesional || "").trim();
    const servicioNombre = String(req.body.servicio || "").trim();
    const fecha = String(req.body.fecha || "").trim();
    const horaElegida = String(req.body.hora || "").trim();
    const nombre = String(req.body.nombre || "").trim();
    const whatsapp = String(req.body.whatsapp || "").trim();

    if (
        !profesional ||
        !servicioNombre ||
        !fecha ||
        !horaElegida ||
        !nombre ||
        !whatsapp ||
        !fechaValida(fecha)
    ) {
        return res.status(400).json({ mensaje: "Completá todos los datos de la reserva." });
    }

    try {
        const categorias = await obtenerCatalogo(profesional);
        const servicio = buscarServicio(categorias, servicioNombre);

        if (!servicio) {
            return res.status(404).json({ mensaje: "El servicio ya no está disponible." });
        }

        const inicio = minutos(horaElegida);
        const duracion = Number(servicio.duracion) || 60;
        const negocio = await obtenerNegocio(profesional);
        const dia = negocio.horarios?.[dias[new Date(`${fecha}T12:00:00`).getDay()]];

        if (
            !dia?.activo ||
            inicio === null ||
            inicio % 30 !== 0 ||
            inicio < minutos(dia.inicio) ||
            inicio + duracion > minutos(dia.fin)
        ) {
            return res.status(400).json({ mensaje: "Ese horario no está disponible." });
        }

        if (
            dia.descansoInicio &&
            superpone(
                inicio,
                inicio + duracion,
                minutos(dia.descansoInicio),
                minutos(dia.descansoFin)
            )
        ) {
            return res.status(400).json({ mensaje: "Ese horario coincide con el descanso." });
        }

        const existentes = await reservas.find({
            profesional,
            fecha,
            estado: { $ne: "cancelada" }
        }).toArray();

        const conflicto = existentes.some(r => {
            const rango = calcularRango(r);
            return superpone(inicio, inicio + duracion, rango.inicio, rango.fin);
        });

        if (conflicto) {
            return res.status(409).json({ mensaje: "Ese horario ya está reservado." });
        }

        const nuevo = {
            profesional,
            servicio: servicioNombre,
            fecha,
            hora: horaElegida,
            inicioMinutos: inicio,
            duracion,
            precio: Number(servicio.precio) || 0,
            sena: Number(servicio.sena) || 0,
            nombre,
            whatsapp,
            estado: "confirmada",
            fechaCreacion: new Date()
        };

        const resultado = await reservas.insertOne(nuevo);

        res.status(201).json({
            mensaje: "¡Tu turno quedó reservado!",
            reserva: { ...nuevo, _id: resultado.insertedId }
        });

    } catch (e) {
        if (e.code === 11000) {
            return res.status(409).json({ mensaje: "Ese horario ya está reservado." });
        }

        console.error(e);
        res.status(500).json({ mensaje: "No pudimos guardar la reserva." });
    }
});

// TURNOS PRIVADOS DEL PROFESIONAL
app.get("/api/profesional/reservas", autenticar, async (req, res) => {
    try {
        res.json(
            await reservas.find({ profesional: profesionalActual(req) })
                .sort({ fecha: 1, hora: 1 })
                .toArray()
        );
    } catch {
        res.status(500).json({ mensaje: "No pudimos cargar tu agenda." });
    }
});

// AGREGAR TURNO MANUAL
app.post("/api/profesional/reservas", autenticar, async (req, res) => {
    const profesional = profesionalActual(req);
    const nombre = String(req.body.nombre || "").trim();
    const servicio = String(req.body.servicio || "").trim();
    const fecha = String(req.body.fecha || "").trim();
    const horaElegida = String(req.body.hora || "").trim();

    if (!nombre || !servicio || !fecha || !horaElegida || !fechaValida(fecha)) {
        return res.status(400).json({ mensaje: "Completá los datos del turno." });
    }

    try {
        const categorias = await obtenerCatalogo(profesional);
        const datos = buscarServicio(categorias, servicio);
        const inicio = minutos(horaElegida);

        if (inicio === null) {
            return res.status(400).json({ mensaje: "La hora no es válida." });
        }

        const duracion = Number(datos?.duracion) || 60;

        const existentes = await reservas.find({
            profesional,
            fecha,
            estado: { $ne: "cancelada" }
        }).toArray();

        if (existentes.some(r => {
            const rango = calcularRango(r);
            return superpone(inicio, inicio + duracion, rango.inicio, rango.fin);
        })) {
            return res.status(409).json({ mensaje: "Ese horario se superpone con otro turno." });
        }

        const nuevo = {
            profesional,
            nombre,
            servicio,
            fecha,
            hora: horaElegida,
            whatsapp: String(req.body.whatsapp || ""),
            inicioMinutos: inicio,
            duracion,
            precio: Number(datos?.precio) || 0,
            sena: Number(datos?.sena) || 0,
            estado: "confirmada",
            origen: "panel",
            fechaCreacion: new Date()
        };

        const resultado = await reservas.insertOne(nuevo);

        res.status(201).json({
            mensaje: "Turno agregado correctamente.",
            reserva: { ...nuevo, _id: resultado.insertedId }
        });

    } catch (e) {
        console.error(e);
        res.status(500).json({ mensaje: "No pudimos guardar el turno." });
    }
});

// CANCELAR TURNO
app.patch("/api/profesional/reservas/:id/cancelar", autenticar, async (req, res) => {
    if (!ObjectId.isValid(req.params.id)) {
        return res.status(400).json({ mensaje: "El identificador del turno no es válido." });
    }

    try {
        const resultado = await reservas.updateOne(
            {
                _id: new ObjectId(req.params.id),
                profesional: profesionalActual(req)
            },
            { $set: { estado: "cancelada", fechaCancelacion: new Date() } }
        );

        if (!resultado.matchedCount) {
            return res.status(404).json({ mensaje: "No encontramos ese turno." });
        }

        res.json({ mensaje: "Turno cancelado." });

    } catch {
        res.status(500).json({ mensaje: "No pudimos cancelar el turno." });
    }
});



// ==========================================
// NEXI - INTELIGENCIA ARTIFICIAL GEMINI
// ==========================================

app.post("/api/ia/chat", async (req, res) => {
    try {
        const mensaje = String(req.body?.mensaje || "").trim();
        const historial = Array.isArray(req.body?.historial)
            ? req.body.historial
            : [];

        const apiKey = process.env.GEMINI_API_KEY;

        if (!mensaje) {
            return res.status(400).json({
                mensaje: "Escribí una consulta."
            });
        }

        if (!apiKey) {
            return res.status(503).json({
                mensaje: "Falta configurar GEMINI_API_KEY en el archivo .env"
            });
        }

  
const yaConversaron = historial.some(
    item => item && item.role === "assistant"
);

const instrucciones = `
Sos Nexi, la asistente virtual de Nexiuma.

Nexiuma es una plataforma de agenda inteligente para profesionales independientes y consultorios.

PLANES:
- Básico: U$S 10 por mes.
- Pro: U$S 18 por mes.
- Consultorios: U$S 29 por mes.
Todos incluyen 7 días de prueba gratuita.

PERSONALIDAD:
Sos amable, cálida, cercana y profesional.
Hablás en español rioplatense.

REGLAS OBLIGATORIAS:
- Respondé directamente lo que te preguntan.
- Usá como máximo 2 oraciones y 40 palabras.
- No repitas información.
- No termines todas las respuestas con preguntas.
- No inventes funciones ni características.
- Si no sabés algo, reconocelo.
- Usá el historial para mantener el contexto.

${yaConversaron
    ? "ESTA CONVERSACIÓN YA COMENZÓ. ESTÁ PROHIBIDO SALUDAR, DECIR HOLA O VOLVER A PRESENTARTE. Respondé directamente."
    : "Esta es la primera consulta. Podés saludar brevemente una sola vez."
}
`;


        const contenidosAnteriores = historial
            .filter(item =>
                item &&
                ["user", "assistant", "model"].includes(item.role) &&
                typeof item.content === "string" &&
                item.content.trim()
            )
            .slice(-12)
            .map(item => ({
                role: item.role === "assistant" ? "model" : item.role,
                parts: [{ text: item.content.trim() }]
            }));

        const contents = [
            ...contenidosAnteriores,
            {
                role: "user",
                parts: [{ text: mensaje }]
            }
        ];

        const respuestaIA = await fetch(
            "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-goog-api-key": apiKey
                },
                body: JSON.stringify({
                    system_instruction: {
                        parts: [{ text: instrucciones }]
                    },
                    contents,
                    generationConfig: {
                        temperature: 0.5,
                        maxOutputTokens: 180
                    }
                })
            }
        );

        const contenido = await respuestaIA.text();

        let datos;
        try {
            datos = JSON.parse(contenido);
        } catch {
            console.error("RESPUESTA NO JSON DE GEMINI:", contenido);
            return res.status(502).json({
                mensaje: "Gemini devolvió una respuesta inválida."
            });
        }

        if (!respuestaIA.ok) {
            console.error("ERROR GEMINI:", datos);
            return res.status(502).json({
                mensaje: datos.error?.message ||
                    "Google rechazó la solicitud de Nexi."
            });
        }

        const texto = datos.candidates?.[0]?.content?.parts
            ?.map(p => p.text || "")
            .join("")
            .trim();

        if (!texto) {
            return res.status(502).json({
                mensaje: "Gemini no generó texto. Intentá nuevamente."
            });
        }

        return res.json({ respuesta: texto });

    } catch (error) {
        console.error("ERROR NEXI:", error);
        return res.status(500).json({
            mensaje: "Error de conexión: " + error.message
        });
    }
});




// INICIAR SERVIDOR
async function iniciarServidor() {
    try {
        if (!process.env.MONGODB_URI) throw new Error("Falta MONGODB_URI en .env");
        if (!process.env.ADMIN_PASSWORD || !process.env.ADMIN_TOKEN) {
            throw new Error("Faltan las claves del administrador en .env");
        }
        if (!process.env.JWT_SECRET) throw new Error("Falta JWT_SECRET en .env");
        if (!process.env.OWNER_EMAIL) throw new Error("Falta OWNER_EMAIL en .env");

        await cliente.connect();

        const db = cliente.db("nexiuma");

        consultas = db.collection("consultas");
        reservas = db.collection("reservas");
        servicios = db.collection("servicios");
        negocios = db.collection("negocios");
        usuarios = db.collection("usuarios");

        await usuarios.createIndex({ email: 1 }, { unique: true });
        await usuarios.createIndex({ profesional: 1 }, { unique: true });
        await reservas.createIndex(
            { profesional: 1, fecha: 1, hora: 1 },
            { unique: true }
        );

        console.log("Conexión con MongoDB exitosa.");
        console.log("Colecciones listas: consultas, reservas, servicios, negocios y usuarios.");

        app.listen(PORT, () => {
            console.log(`Servidor funcionando en http://localhost:${PORT}`);
        });

    } catch (e) {
        console.error("ERROR AL INICIAR:", e);
        process.exit(1);
    }
}

iniciarServidor();