const header = document.querySelector("header");

window.addEventListener("scroll", function () {

    if (window.scrollY > 20) {
        header.classList.add("scrolled");
    } else {
        header.classList.remove("scrolled");
    }

});



const cards = document.querySelectorAll(".card-funciones");

const posiciones = [
    "left2",
    "left1",
    "active",
    "right1",
    "right2"
];

function actualizar() {

    cards.forEach((card, i) => {

        card.classList.remove(
            "left2",
            "left1",
            "active",
            "right1",
            "right2"
        );

        card.classList.add(posiciones[i]);

    });

}

function siguiente(){

    posiciones.push(posiciones.shift());

    actualizar();

}

function anterior(){

    posiciones.unshift(posiciones.pop());

    actualizar();

}

const botonSiguiente = document.querySelector(".next");
const botonAnterior = document.querySelector(".prev");

if (botonSiguiente && botonAnterior) {

    botonSiguiente.addEventListener("click", siguiente);

    botonAnterior.addEventListener("click", anterior);

    setInterval(siguiente, 2500);

    actualizar();

}




// FORMULARIO DE CONTACTO

const formulario = document.querySelector("#formContacto");

if (formulario) {

    formulario.addEventListener("submit", async function(event) {

        event.preventDefault();

        const datos = {
            nombre: document.querySelector("#nombre").value,
            email: document.querySelector("#email").value,
            whatsapp: document.querySelector("#whatsapp").value,
            profesion: document.querySelector("#profesion").value,
            mensaje: document.querySelector("#mensaje").value
        };

        try {

            const respuesta = await fetch("http://localhost:3001/api/contacto", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(datos)
            });

            const resultado = await respuesta.json();
            console.log("Respuesta del servidor:", resultado);

            if (!respuesta.ok) {
                throw new Error("No se pudo enviar la consulta");
            }

            formulario.innerHTML = `
                <div class="mensaje-exito">
                    <h2>¡Recibimos tus datos!</h2>
                    <p>${resultado.mensaje}</p>
                </div>
            `;

        } catch (error) {

            console.error("Error al enviar:", error);

            alert("No pudimos enviar tu consulta. Intentá nuevamente.");

        }

    });

}
