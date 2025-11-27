const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
const resultado = document.getElementById("resultado");
const btnIniciar = document.getElementById("iniciar");

let bola, rozamientoZona, animacionActiva, offset;

function inicializar() {
  const masa = parseFloat(document.getElementById("masa").value);
  const velocidad = parseFloat(document.getElementById("velocidad").value);
  const distancia = parseFloat(document.getElementById("distancia").value);

  bola = {
    x: 11,
    y: 200,
    radio: 10,
    masa,
    velocidad,
    distanciaRecorrida: 0,
    energiaInicial: 0.5 * masa * velocidad * velocidad,
    energiaFinal: 0,
  };

  rozamientoZona = {
    inicio: 400,   // 400px desde el comienzo del mundo
    fin: 600,
  };

  bola.longitudTotal = distancia * 30; // convierte metros en píxeles (escala)
  offset = 0; // posición del "mundo" mostrada en pantalla

  resultado.textContent = "";
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  dibujarEscena();
}

function dibujarEscena() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Calcular desplazamiento de cámara
  offset = bola.x - canvas.width / 2;
  if (offset < 0) offset = 0;
  if (offset > bola.longitudTotal - canvas.width) offset = bola.longitudTotal - canvas.width;

  // Dibujar piso
  ctx.fillStyle = "rgb(151, 225, 248)";
  ctx.fillRect(-offset, 210, bola.longitudTotal, 3);

  // Dibujar puntos de rozamiento
  ctx.fillStyle = "red";
  for (let x = rozamientoZona.inicio; x < rozamientoZona.fin; x += 10) {
    ctx.beginPath();
    ctx.arc(x - offset, 212, 2, 0, Math.PI * 2);
    ctx.fill();
  }

  // Dibujar bola (ajustada por offset)
  ctx.beginPath();
  ctx.arc(bola.x - offset, bola.y, bola.radio, 0, Math.PI * 2);
  ctx.fillStyle ="rgb(26, 124, 83)";
  ctx.fill();
}

function moverBola() {
  const dt = 0.1;
  const rozamiento = 0.1;
  const posicionEnZona = bola.x > rozamientoZona.inicio && bola.x < rozamientoZona.fin;

  if (posicionEnZona) {
    bola.velocidad -= rozamiento;
    if (bola.velocidad < 0) bola.velocidad = 0;
  }

  bola.x += bola.velocidad * dt * 10;
  bola.distanciaRecorrida += bola.velocidad * dt;

  dibujarEscena();

  if (bola.x >= bola.longitudTotal || bola.velocidad <= 0) {
    bola.energiaFinal = 0.5 * bola.masa * bola.velocidad * bola.velocidad;
    resultado.textContent = `Energía final: ${bola.energiaFinal.toFixed(2)} J`;
    cancelAnimationFrame(animacionActiva);
    return;
  }

  animacionActiva = requestAnimationFrame(moverBola);
}

btnIniciar.addEventListener("click", () => {
  inicializar();
  cancelAnimationFrame(animacionActiva);
  animacionActiva = requestAnimationFrame(moverBola);
});

inicializar();
