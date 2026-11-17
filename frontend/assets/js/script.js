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

    formulario.addEventListener("submit", function(event) {

        event.preventDefault();

        const nombre = document.querySelector("#nombre").value;
        const email = document.querySelector("#email").value;
        const whatsapp = document.querySelector("#whatsapp").value;
        const profesion = document.querySelector("#profesion").value;
        const mensaje = document.querySelector("#mensaje").value;

        console.log(nombre, email, whatsapp, profesion, mensaje);

        formulario.innerHTML = `
            <div class="mensaje-exito">
                <h2>¡Recibimos tus datos!</h2>
                <p>Gracias por contactarte con Nexiuma.</p>
                <p>En breve nos comunicaremos contigo.</p>
            </div>
        `;

    });

}
