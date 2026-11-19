// HEADER: efecto al desplazarse
const header = document.querySelector("header");

if (header) {
    window.addEventListener("scroll", () => {
        header.classList.toggle("scrolled", window.scrollY > 20);
    });
}


// CARRUSEL DE FUNCIONES
const cards = document.querySelectorAll(".card-funciones");
const botonSiguiente = document.querySelector(".next");
const botonAnterior = document.querySelector(".prev");

const posiciones = ["left2", "left1", "active", "right1", "right2"];

function actualizarCarrusel() {
    cards.forEach((card, index) => {
        card.classList.remove("left2", "left1", "active", "right1", "right2");
        card.classList.add(posiciones[index]);
    });
}

function siguiente() {
    posiciones.unshift(posiciones.pop());
    actualizarCarrusel();
}

function anterior() {
    posiciones.push(posiciones.shift());
    actualizarCarrusel();
}

if (cards.length === 5) {
    actualizarCarrusel();

    botonSiguiente?.addEventListener("click", siguiente);
    botonAnterior?.addEventListener("click", anterior);

    let intervaloCarrusel = setInterval(siguiente, 2500);

    const carrusel = document.querySelector(".carrusel");

    if (carrusel) {
        carrusel.addEventListener("mouseenter", () => {
            clearInterval(intervaloCarrusel);
        });

        carrusel.addEventListener("mouseleave", () => {
            clearInterval(intervaloCarrusel);
            intervaloCarrusel = setInterval(siguiente, 2500);
        });
    }
}


// FORMULARIO DE CONTACTO
const formulario = document.querySelector("#formContacto");
const estadoContacto = document.querySelector("#estadoContacto");

if (formulario) {
    formulario.addEventListener("submit", async (event) => {
        event.preventDefault();

        const boton = formulario.querySelector('button[type="submit"]');
        const datos = {
            nombre: formulario.querySelector("#nombre").value.trim(),
            email: formulario.querySelector("#email").value.trim(),
            whatsapp: formulario.querySelector("#whatsapp").value.trim(),
            profesion: formulario.querySelector("#profesion").value.trim(),
            mensaje: formulario.querySelector("#mensaje").value.trim()
        };

        if (!datos.nombre || !datos.email || !datos.whatsapp || !datos.mensaje) {
            if (estadoContacto) {
                estadoContacto.textContent = "Completá todos los campos obligatorios.";
            }
            return;
        }

        boton.disabled = true;
        boton.textContent = "Enviando...";

        if (estadoContacto) {
            estadoContacto.textContent = "";
        }

        try {
            const respuesta = await fetch("https://nexiuma-backend.onrender.com/api/contacto", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(datos)
            });

            const resultado = await respuesta.json();

            if (!respuesta.ok) {
                throw new Error(resultado.mensaje || "No se pudo enviar la consulta.");
            }

            formulario.innerHTML = `
                <div class="mensaje-exito">
                    <h2>¡Recibimos tus datos!</h2>
                    <p>${resultado.mensaje || "Tu consulta fue enviada correctamente."}</p>
                    <p>Gracias por comunicarte con Nexiuma.</p>
                </div>
            `;
        } catch (error) {
            console.error("Error al enviar la consulta:", error);

            if (estadoContacto) {
                estadoContacto.textContent =
                    error.message || "No pudimos enviar tu consulta. Intentá nuevamente.";
            }

            boton.disabled = false;
            boton.textContent = "Enviar consulta";
        }
    });
}