// script.js
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
const resultado = document.getElementById("resultado");
const btnIniciar = document.getElementById("iniciar");
const btnModelo1 = document.getElementById("modelo1");
const btnModelo2 = document.getElementById("modelo2");
const btnModelo3 = document.getElementById("modelo3");
const btnModelo4 = document.getElementById("modelo4");
const btnModelo5 = document.getElementById("modelo5");

const labelAltura = document.getElementById("label-altura");
const labelDistancia = document.getElementById("label-distancia");
const labelVelocidad = document.getElementById("label-velocidad");

let tiempo = 0;
let bola, rozamientoZona, animacionActiva = null, offset = 0, modeloActual = 1;

canvas.width = Math.max(canvas.width, 700);
canvas.height = Math.max(canvas.height, 300);

// Elementos de energía
const epDisplay = document.getElementById("ep")
const ekDisplay = document.getElementById("ek")
const etDisplay = document.getElementById("et")
const eeDisplay = document.getElementById("ee")
const elostDisplay = document.getElementById("elost")

// resorte
let resorteCompresion = 0;
let resorteMaxCompresion = 50;
let k = 0.5;

function pixelsAMetros(px) {
    return px / 100
}

function calcularEnergiaP(x, y) {
    if (modeloActual !== 3 && modeloActual !== 4) return 0;

    const rampaLargo = 300;
    const pisoY = curvaRampaY(rampaLargo);

    if (y + bola.radio >= pisoY - 1) {
        return 0;
    }

    const alturaActual = pisoY - (y + bola.radio);
    const h = pixelsAMetros(Math.max(0, alturaActual));
    const g = 9.81;

    return bola.masa * g * h;
}

function calcularEnergiaK(velocidad) {
    return 0.5 * bola.masa * velocidad * velocidad
}

function actualizarEnergia() {
    let ep = 0, ek = 0, ee = 0;

    if (modeloActual === 3) {
        ep = calcularEnergiaP(bola.x, bola.y);
        ek = bola.energiaInicial - ep;
        if (ek < 0) ek = 0;
        ee = 0;
    }

    if (modeloActual === 4) {
        ep = calcularEnergiaP(bola.x, bola.y);
        ee = bola.energiaElastica || 0;

        const pisoY = curvaRampaY(300);

        if (bola.y + bola.radio < pisoY - 1) {
            ek = 0;
        } else {
            ek = bola.energiaInicial - ep - ee;
        }
        if (ek < 0) ek = 0;
    }

    if (modeloActual === 1 || modeloActual === 2 ||modeloActual===5) {
        ek = calcularEnergiaK(bola.velocidad);
    }

    const et = ep + ek + ee;
    let elost = 0;

    if (modeloActual === 2 || modeloActual === 4) {
        elost = Math.max(0, bola.energiaInicial - (ep + ek + ee));
    }

    epDisplay.textContent = ep.toFixed(2) + " J";
    ekDisplay.textContent = ek.toFixed(2) + " J";
    etDisplay.textContent = et.toFixed(2) + " J";
    eeDisplay.textContent = ee.toFixed(2) + " J";
    elostDisplay.textContent = elost.toFixed(2) + " J";
}

// ENERGIA RESORTE
function calcularEnergiaPResorte(compresionPx) {
    if (compresionPx <= 0) return 0;

    const compresionM = pixelsAMetros(compresionPx);
    return 0.5 * k * compresionM * compresionM;
}

function clamp(v, a, b) {
    return Math.max(a, Math.min(b, v));
}

// ----- curva Bézier aproximada -----
function curvaRampaY(x) {
    const rampaLargo = 300;
    const yBase = 200;
    const altura = 140;

    if (x <= 0) return yBase - altura;
    if (x >= rampaLargo) return yBase + 20;

    const t = x / rampaLargo;

    return (yBase - altura) + (1 - (1 - t)*(1 - t)) * (altura + 20);
}

function dibujarRampaCurva(offsetLocal = 0) {
    ctx.strokeStyle = "#999";
    ctx.lineWidth = 3;

    ctx.beginPath();

    for (let px = 0; px <= 600; px += 2) {
        const y = curvaRampaY(px);
        if (px === 0) ctx.moveTo(px - offsetLocal, y);
        else ctx.lineTo(px - offsetLocal, y);
    }
    ctx.stroke();
}

function dibujarRampaCurvaResorte(offsetLocal = 0) {
    ctx.strokeStyle = "#999";
    ctx.lineWidth = 3;
    ctx.beginPath();

    for (let px = 0; px <= 600; px += 2) {
        let y = curvaRampaY(px);
        if (isNaN(y)) y = 300;
        const xReal = px - offsetLocal;

        if (px === 0) ctx.moveTo(xReal, y);
        else ctx.lineTo(xReal, y);
    }
    ctx.stroke();

    let xFinal = 520 - offsetLocal;
    let yFinal = curvaRampaY(600) - 15;

    if (xFinal > canvas.width) xFinal = canvas.width - 1;
    if (xFinal < 0) xFinal = 0;

    const largoResorte = 80;
    const zigZags = 10;
    const amplitud = 10;
    const paso = largoResorte / zigZags;

    ctx.beginPath();
    ctx.strokeStyle = "red";
    ctx.lineWidth = 3;
    ctx.moveTo(xFinal, yFinal);

    for (let i = 1; i <= zigZags; i++) {
        const x = xFinal + paso * i;
        const y = yFinal + (i % 2 === 0 ? -amplitud : amplitud);
        ctx.lineTo(x, y);
    }
    ctx.stroke();
}

// ---------------- Inicializar ----------------
function inicializar() {
    const masa = parseFloat(document.getElementById("masa").value) || 1;
    const velocidadIn = parseFloat(document.getElementById("velocidad").value) || 0;
    const distancia = parseFloat(document.getElementById("distancia").value) || 200;
    const radio = 10;

    if (modeloActual === 1 || modeloActual === 2) {
        bola = {
            x: 11, y: 200, radio, masa,
            velocidad: velocidadIn,
            distanciaRecorrida: 0,
            energiaInicial: 0.5 * masa * velocidadIn * velocidadIn,
            energiaFinal: 0,
            longitudTotal: distancia * 30,
            trail: []
        };
    }

    else if (modeloActual === 3) {
        const altura = parseFloat(document.getElementById("altura").value) || 1;

        bola = {
            x: 0,
            y: curvaRampaY(0) - radio,
            radio, masa,
            velocidad: 0,
            distanciaRecorrida: 0,
            energiaInicial: masa * 9.81 * altura,
            energiaFinal: 0,
            longitudTotal: 600,
            trail: []
        };
    }

    else if (modeloActual === 4) {
        const altura = parseFloat(document.getElementById("altura").value) || 1;

        bola = {
            x: 0,
            y: curvaRampaY(0) - radio,
            radio, masa,
            velocidad: 0,
            energiaInicial: masa * 9.81 * altura,
            energiaElastica: 0,
            longitudTotal: 600,
            trail: []
        };
    }

    else if (modeloActual === 5) {
        const distancia = parseFloat(document.getElementById("distancia").value) || 200;
        const masa = parseFloat(document.getElementById("masa").value) || 1;
        const velocidadIn = parseFloat(document.getElementById("velocidad").value) || 0;

        bola = {
            x: 11, y: 200, radio, masa,
            velocidad: velocidadIn,
            distanciaRecorrida: 0,
            energiaInicial: 0.5 * masa * velocidadIn * velocidadIn,
            energiaElastica: 0,
            longitudTotal: distancia * 30,
            trail: []
        };

        rozamientoZona = { inicio: 400, fin: 600 };
    }

    rozamientoZona = { inicio: 350, fin: 450 };

    offset = 0;
    resultado.textContent = "Energía final:";

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    dibujarEscena();
}

// ----------------- Dibujar -----------------
function dibujarEscena() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    offset = bola.x - canvas.width * 0.25;
    if (offset < 0) offset = 0;
    if (offset > bola.longitudTotal - canvas.width)
        offset = bola.longitudTotal - canvas.width;

    if (modeloActual === 1) {
        ctx.fillStyle = "rgb(151,225,248)";
        ctx.fillRect(-offset, 210, bola.longitudTotal + offset + 100, 3);
    }

    else if (modeloActual === 2) {
        ctx.fillStyle = "rgb(200,180,150)";
        ctx.fillRect(-offset, 210, bola.longitudTotal + offset + 100, 3);

        ctx.fillStyle = "red";
        for (let x = rozamientoZona.inicio; x < rozamientoZona.fin; x += 12) {
            ctx.beginPath();
            ctx.arc(x - offset, 212, 2, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    else if (modeloActual === 3) {
        dibujarRampaCurva(offset);

        ctx.strokeStyle = "#666";
        ctx.lineWidth = 2;
        ctx.beginPath();

        const rampaLargo = 300;
        const startX = rampaLargo - offset;
        const startY = curvaRampaY(rampaLargo);

        ctx.moveTo(startX, startY);
        ctx.lineTo(bola.longitudTotal - offset, startY);
        ctx.stroke();
    }

    else if (modeloActual === 4) {
        dibujarRampaCurvaResorte(offset);

        const rampaLargo = 300;
        const pisoY = curvaRampaY(rampaLargo);

        ctx.strokeStyle = "#666";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(rampaLargo - offset, pisoY);
        ctx.lineTo(bola.longitudTotal - offset, pisoY);
        ctx.stroke();

        ctx.fillStyle = "red";
        for (let x = rozamientoZona.inicio; x < rozamientoZona.fin; x += 12) {
            ctx.beginPath();
            ctx.arc(x - offset, pisoY + 5, 2, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    else if (modeloActual === 5) {
        ctx.fillStyle = "rgb(200,180,150)";
        ctx.fillRect(-offset, 210, bola.longitudTotal + offset + 100, 3);

        ctx.fillStyle = "red";
        for (let x = rozamientoZona.inicio; x < rozamientoZona.fin; x += 12) {
            ctx.beginPath();
            ctx.arc(x - offset, 212, 2, 0, Math.PI * 2);
            ctx.fill();
        }

        let xFinal = bola.longitudTotal - 80 - offset;
        let yFinal = 200 - 15;
        const largoResorte = 80;
        const zigZags = 10;
        const amplitud = 10;
        const paso = largoResorte / zigZags;

        ctx.beginPath();
        ctx.strokeStyle = "red";
        ctx.lineWidth = 3;
        ctx.moveTo(xFinal, yFinal);

        for (let i = 1; i <= zigZags; i++) {
            const x = xFinal + paso * i;
            const y = yFinal + (i % 2 === 0 ? -amplitud : amplitud);
            ctx.lineTo(x, y);
        }
        ctx.stroke();
    }

    bola.trail.forEach((p, i) => {
        const op = i / bola.trail.length;
        const salto = Math.sin(tiempo + i * 0.5) * 2;

        ctx.fillStyle = `rgba(26,124,83, ${op * 0.6})`;
        ctx.beginPath();
        ctx.arc(p.x - offset, p.y + salto, bola.radio * 0.7, 0, Math.PI * 2);
        ctx.fill();
    });

    ctx.beginPath();
    ctx.fillStyle = "rgb(26,124,83)";
    ctx.arc(bola.x - offset, bola.y, bola.radio, 0, Math.PI * 2);
    ctx.fill();
}

// ----------------- Movimiento -----------------
function moverBola() {
    const dt = 0.1;
    const rozamiento = 0.1;

    // -------- MODELO 5 --------
    if (modeloActual === 5) {
        const dt = 0.1;
        const rozamiento = 0.1;

        const enZonaRoz = bola.x > rozamientoZona.inicio && bola.x < rozamientoZona.fin;
        const f = rozamiento * 9;

        if (enZonaRoz){
            if (bola.velocidad > 0) bola.velocidad -= rozamiento;
            else if (bola.velocidad < 0) bola.velocidad += rozamiento;
        }

        bola.x += bola.velocidad * dt * 10;

        const inicioResorte = bola.longitudTotal - 80;
        const k = 150;

        if (bola.x + bola.radio >= inicioResorte) {
            let compresionPx = (bola.x + bola.radio) - inicioResorte;
            let compresion = compresionPx / 100;

            bola.energiaInicial = bola.energiaElastica;

            const F_resorte = -k * compresion;
            const a_resorte = F_resorte / bola.masa;

            bola.velocidad += a_resorte * dt * 10;

            const maxCompresionPx = 40;
            if (compresionPx > maxCompresionPx) {
                compresionPx = maxCompresionPx;
                bola.x = inicioResorte - bola.radio + maxCompresionPx;
            }
        }
    }

    // -------- MODELO 4 --------
    if (modeloActual === 4) {
        const dx = 1;
        const dy = curvaRampaY(bola.x + dx) - curvaRampaY(Math.max(0, bola.x - dx));
        const pendiente = dy / (2 * dx);
        const ang = Math.atan(pendiente || 0);
        const g = 9.81;
        const a = g * Math.sin(ang);

        bola.velocidad += a * dt;
        bola.velocidad = clamp(bola.velocidad, -200, 200);
        bola.x += bola.velocidad * dt * 10;

        const rampaLargo = 300;
        const pisoY = curvaRampaY(rampaLargo);

        if (bola.x < rampaLargo) {
            bola.y = curvaRampaY(bola.x) - bola.radio;
        } else {
            bola.y = pisoY - bola.radio;
        }

        if (bola.x > rozamientoZona.inicio && bola.x < rozamientoZona.fin) {
            if (bola.velocidad > 0) bola.velocidad -= 0.1;
            else bola.velocidad += 0.1;

            if (Math.abs(bola.velocidad) < 0.002) bola.velocidad = 0;
        }

        const inicioResorte = 520;
        const kResorte = 3;

        if (bola.x + bola.radio >= inicioResorte) {
            const compresion = (bola.x + bola.radio) - inicioResorte;

            if (compresion > 0) {
                bola.energiaElastica = 0.5 * kResorte * compresion * compresion;
                const F_resorte = -kResorte * compresion;
                const a_resorte = F_resorte / bola.masa;

                bola.velocidad += a_resorte;
                bola.x += bola.velocidad * dt * 10;
                bola.y = pisoY - bola.radio;
            }
        }
    }

    // -------- MODELO 3 --------
    if (modeloActual === 3) {
        const dx = 1;
        const dy = curvaRampaY(bola.x + dx) - curvaRampaY(Math.max(0, bola.x - dx));
        const pendiente = dy / (2 * dx);
        const ang = Math.atan(pendiente || 0);
        const g = 9.81;
        const a = g * Math.sin(ang);

        bola.velocidad += a * dt;
        bola.velocidad = clamp(bola.velocidad, -200, 200);

        bola.x += bola.velocidad * dt * 10;
        bola.y = curvaRampaY(bola.x) - bola.radio;
    }

    // -------- MODELO 2 --------
    if (modeloActual === 2) {
        const enZona = bola.x > rozamientoZona.inicio && bola.x < rozamientoZona.fin;

        if (enZona) {
            bola.velocidad -= rozamiento;
            if (bola.velocidad < 0) bola.velocidad = 0;
        }

        bola.x += bola.velocidad * dt * 10;
        bola.distanciaRecorrida += bola.velocidad * dt;
    }

    // -------- MODELO 1 --------
    if (modeloActual === 1) {
        bola.x += bola.velocidad * dt * 10;
        bola.distanciaRecorrida += bola.velocidad * dt;
    }

    dibujarEscena();
    actualizarEnergia();

    bola.trail.push({ x: bola.x, y: bola.y });
    if (bola.trail.length > 15) bola.trail.shift();

    tiempo += 0.15;

    if (bola.x >= bola.longitudTotal) {
        if (modeloActual === 3) {
            const vFinal = Math.sqrt((2 * bola.energiaInicial) / bola.masa);

            epDisplay.textContent = "0.00 J";
            ekDisplay.textContent = bola.energiaInicial.toFixed(2) + " J";
            etDisplay.textContent = bola.energiaInicial.toFixed(2) + " J";
            elostDisplay.textContent = "0.00 J";

            resultado.textContent = `Energía final: ${bola.energiaInicial.toFixed(2)} J ——— Velocidad final: ${vFinal.toFixed(2)} m/s`;
        } else {
            bola.energiaFinal = 0.5 * bola.masa * bola.velocidad * bola.velocidad;
            resultado.textContent = `Energía final: ${bola.energiaFinal.toFixed(2)} J`;
        }

        cancelAnimationFrame(animacionActiva);
        animacionActiva = null;
        return;
    }

      // ---- NUEVO: detectar cuando vuelve hacia la izquierda y queda frenada ----
      if (modeloActual === 5) {

      // si la velocidad se hace muy chica, la damos como detenida
      if (Math.abs(bola.velocidad) < 0.02 && bola.x < rozamientoZona.fin) {
  
      bola.velocidad = 0;

      // energía final toda cinética (pero como está quieta, es 0)
      bola.energiaFinal = 0.5 * bola.masa * bola.velocidad * bola.velocidad;

      resultado.textContent =
     `Energía final: ${bola.energiaFinal.toFixed(2)} J`;

      cancelAnimationFrame(animacionActiva);
      animacionActiva = null;
      return;
    }
  }

    animacionActiva = requestAnimationFrame(moverBola);
}

// ----------------- EVENTOS -----------------
btnIniciar.addEventListener("click", () => {
    inicializar();
    if (animacionActiva) cancelAnimationFrame(animacionActiva);
    animacionActiva = requestAnimationFrame(moverBola);
});

btnModelo1.addEventListener("click", () => {
    modeloActual = 1;
    btnModelo1.style.backgroundColor = "rgb(100,180,255)";
    labelAltura.style.display = "none";
    labelDistancia.style.display = "block";

    btnModelo2.style.backgroundColor = "";
    btnModelo3.style.backgroundColor = "";
    btnModelo4.style.backgroundColor = "";
    btnModelo5.style.backgroundColor = "";
});

btnModelo2.addEventListener("click", () => {
    modeloActual = 2;
    btnModelo2.style.backgroundColor = "rgb(100,180,255)";
    labelAltura.style.display = "none";
    labelDistancia.style.display = "block";

    btnModelo1.style.backgroundColor = "";
    btnModelo3.style.backgroundColor = "";
    btnModelo4.style.backgroundColor = "";
    btnModelo5.style.backgroundColor = "";
});

btnModelo3.addEventListener("click", () => {
    modeloActual = 3;
    btnModelo3.style.backgroundColor = "rgb(100,180,255)";
    labelAltura.style.display = "block";
    labelVelocidad.style.display = "none";
    labelDistancia.style.display = "none";

    btnModelo1.style.backgroundColor = "";
    btnModelo2.style.backgroundColor = "";
    btnModelo4.style.backgroundColor = "";
    btnModelo5.style.backgroundColor = "";
});

btnModelo4.addEventListener("click", () => {
    modeloActual = 4;
    btnModelo4.style.backgroundColor = "rgb(100,180,255)";
    labelAltura.style.display = "block";
    labelVelocidad.style.display = "none";
    labelDistancia.style.display = "none";

    btnModelo1.style.backgroundColor = "";
    btnModelo2.style.backgroundColor = "";
    btnModelo3.style.backgroundColor = "";
    btnModelo5.style.backgroundColor = "";
});

btnModelo5.addEventListener("click", () => {
    modeloActual = 5;
    btnModelo5.style.backgroundColor = "rgb(100,180,255)";
    labelAltura.style.display = "none";
    labelVelocidad.style.display = "block";
    labelDistancia.style.display = "block";

    btnModelo1.style.backgroundColor = "";
    btnModelo2.style.backgroundColor = "";
    btnModelo3.style.backgroundColor = "";
    btnModelo4.style.backgroundColor = "";
});

btnModelo1.classList.add("activo");

inicializar();
