// script.js - reemplazar completo pero manteniendo tu estructura y IDs
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
const resultado = document.getElementById("resultado");
const btnIniciar = document.getElementById("iniciar");
const btnModelo1 = document.getElementById("modelo1");
const btnModelo2 = document.getElementById("modelo2");
const btnModelo3 = document.getElementById("modelo3");


let bola, rozamientoZona, animacionActiva = null, offset = 0, modeloActual = 1;

// Ajustes visuales para que la rampa sea visible en el canvas
canvas.width = Math.max(canvas.width, 700);
canvas.height = Math.max(canvas.height, 300);

// FUNCIONES AUX
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

// ----- Función de rampa (curva tipo Bézier aproximada via parábola) -----
function curvaRampaY(x) {
  // x en píxeles, definimos tramo de rampa de 0..rampaLargo
  const rampaLargo = 300;      // px donde termina la curva y empieza el piso
  const yBase = 200;           // nivel base (arriba)
  const altura = 140;          // cuanto baja la rampa (px)

  if (x <= 0) return yBase - altura;               // inicio arriba
  if (x >= rampaLargo) return yBase + 20;          // suelo (ligero offset)
  // parábola suave: devuelve valores entre (yBase-altura) ... (yBase+20)
  const t = x / rampaLargo; // 0..1
  // fórmula: empieza alto, baja rápido y termina plano
  const y = (yBase - altura) + (1 - (1 - t) * (1 - t)) * (altura + 20);
  return y;
}

// para depurar la rampa: puntos
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

// shinboInicializar bola 
function inicializar() {
  const masa = parseFloat(document.getElementById("masa").value) || 1;
  const velocidadIn = parseFloat(document.getElementById("velocidad").value) || 0;
  const distancia = parseFloat(document.getElementById("distancia").value) || 200;

  // valores por defecto para que no se salga de pantalla
  const radio = 10;

  if (modeloActual === 1 || modeloActual === 2) {
    bola = {
      x: 11,
      y: 200,
      radio,
      masa,
      velocidad: velocidadIn,
      distanciaRecorrida: 0,
      energiaInicial: 0.5 * masa * velocidadIn * velocidadIn,
      energiaFinal: 0,
      longitudTotal: distancia * 30
    };
  } else if (modeloActual === 3) {
    // la bola comienza pegada arriba de la rampa
      const alturaInicial = 140; // Altura máxima de la rampa
      bola = {
        x: 1,
        y: curvaRampaY(1) - radio,
        radio,
        masa,
        velocidad: 0,   // parte quieta arriba; se acelerará por pendiente
        distanciaRecorrida: 0,
        energiaInicial: masa * 9.81 * (alturaInicial / 100), // Energía potencial inicial
        energiaFinal: 0,
        longitudTotal: distancia * 30
      };
    }
  
  // zona de rozamiento (mantengo tus valores)
  rozamientoZona = { inicio: 400, fin: 600 };

  offset = 0;
  resultado.textContent = "Energía final:";
  ctx.fillStyle = "white";
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  dibujarEscena();
}

function dibujarEscena() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // cámara simple: mantenemos la bola visible (no tocar lógica externa)
  offset = bola.x - canvas.width * 0.25;
  if (offset < 0) offset = 0;
  if (offset > bola.longitudTotal - canvas.width) offset = bola.longitudTotal - canvas.width;

  // MODELO 1: suelo simple
  if (modeloActual === 1) {
    ctx.fillStyle = "rgb(151,225,248)";
    ctx.fillRect(-offset, 210, bola.longitudTotal + offset + 100, 3);
  }

  // MODELO 2: suelo con puntos rojos
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

  // MODELO 3: rampa curva
  else if (modeloActual === 3) {
    // dibujar rampa
    dibujarRampaCurva(offset);
    // dibujar un tramo de suelo plano despues de la rampa (para que se vea continuidad)
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

  // bola (ajustada por offset). Si es modelo 3, Y ya está calculada para ajustarse
  ctx.beginPath();
  ctx.fillStyle = "rgb(26,124,83)";
  ctx.arc(bola.x - offset, bola.y, bola.radio, 0, Math.PI * 2);
  ctx.fill();
}

//MOVIMIENTO 
function moverBola(timestamp) {
  
  const dt = 0.1;
  const rozamiento = 0.1;

  // MODELO 3: la bola sigue la curva y se acelera por pendiente
  if (modeloActual === 3) {
    // calculamos pendiente numérica: dy/dx
    const dx = 1;
    const dy = curvaRampaY(bola.x + dx) - curvaRampaY(Math.max(0, bola.x - dx));
    const pendiente = dy / (2 * dx);

    // ángulo y aceleración tangencial
    const ang = Math.atan(pendiente || 0);
    const g = 9.81;
    const a = g * Math.sin(ang); // aceleración a lo largo de x

    // actualizar velocidad y posición (escala para visual)
    bola.velocidad += a * dt;
    // limitador razonable para que no se dispare fuera de pantalla
    bola.velocidad = clamp(bola.velocidad, -200, 200);

    bola.x += bola.velocidad * dt * 10; // escalado visual
    // pegada a la curva (y = curvaRampaY(x) - radio)
    bola.y = curvaRampaY(bola.x) - bola.radio;
  }

  // MODELO 2: rozamiento 
  if (modeloActual === 2) {
    const posicionEnZona = bola.x > rozamientoZona.inicio && bola.x < rozamientoZona.fin;
    if (posicionEnZona) {
      bola.velocidad -= rozamiento;
      if (bola.velocidad < 0) bola.velocidad = 0;
    }
    bola.x += bola.velocidad * dt * 10;
    bola.distanciaRecorrida += bola.velocidad * dt;
  }

  // MODELO 1: simple 
  if (modeloActual === 1) {
    bola.x += bola.velocidad * dt * 10;
    bola.distanciaRecorrida += bola.velocidad * dt;
  }

  dibujarEscena();

  // condición de fin
  if (bola.x >= bola.longitudTotal || bola.velocidad <= 0) {
    bola.energiaFinal = 0.5 * bola.masa * bola.velocidad * bola.velocidad;
    resultado.textContent = `Energía final: ${bola.energiaFinal.toFixed(2)} J`;
    cancelAnimationFrame(animacionActiva);
    animacionActiva = null;
    return;
  }

  // siguiente frame
  animacionActiva = requestAnimationFrame(moverBola);
}

// ----- EVENTOS 
btnIniciar.addEventListener("click", () => {
  inicializar();
  if (animacionActiva) cancelAnimationFrame(animacionActiva);
  animacionActiva = requestAnimationFrame(moverBola);
});

btnModelo1.addEventListener("click", () => {
  modeloActual = 1;
  btnModelo1.style.backgroundColor = "rgb(100,180,255)";
  btnModelo2.style.backgroundColor = "";
  btnModelo3.style.backgroundColor = "";
});

btnModelo2.addEventListener("click", () => {
  modeloActual = 2;
  btnModelo2.style.backgroundColor = "rgb(100,180,255)";
  btnModelo1.style.backgroundColor = "";
  btnModelo3.style.backgroundColor = "";
});

btnModelo3.addEventListener("click", () => {
  modeloActual = 3;
  btnModelo3.style.backgroundColor = "rgb(100,180,255)";
  btnModelo1.style.backgroundColor = "";
  btnModelo2.style.backgroundColor = "";
});


inicializar();
