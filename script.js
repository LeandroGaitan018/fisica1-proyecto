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
const labelMu = document.getElementById("label-mu")


let tiempo = 0;
let bola, rozamientoZona, animacionActiva = null, offset = 0, modeloActual = 1;

canvas.width = Math.max(canvas.width, 700);
canvas.height = Math.max(canvas.height, 300);

// constante del piso visual (coincide con el fillRect que dibuja la "línea")
const PISO_Y = 210;

let alturaRampaMetros = 1.4;

// Elementos de energía
const epDisplay = document.getElementById("ep")
const ekDisplay = document.getElementById("ek")
const etDisplay = document.getElementById("et")
const eeDisplay = document.getElementById("ee")
const elostDisplay = document.getElementById("elost")

// resorte / flags visuales
let resorteCompresion = 0;
let resorteMaxCompresion = 50;
let k = 0.5;
let entroAlResorte = false;
let velocidadEntradaResorte = 0;
let saliendoDelResorte = false;

// visual transfer flags (se usan solo para la UI, no para frenar la física)
let mostrarTransferencia = false;
let framesTransferencia = 0;
let energiaCineticaAntes = 0;

// tolerancia para considerar "cero" energía/velocidad
const EPS = 1e-3;

let datosGrafico = {
    posiciones: [],
    ep: [],
    ek: [],
    ee: [],
    elost: [],
    et: []
};
let chartInstance = null;
let contadorFrames = 0;


function pixelsAMetros(px) {
    return px / 100
}

function calcularEnergiaP(x, y) {
    if (modeloActual !== 3 && modeloActual !== 4) return 0;

    const rampaLargo = 300;
    const pisoY = curvaRampaY(rampaLargo); // Punto final (altura = 0)
    
    // Calcular cuánto está elevado el centro de la bola respecto al piso final
    const centroBola = y + bola.radio;
    const alturaPixels = pisoY - centroBola; // Si está arriba, esto es positivo
    const h = pixelsAMetros(Math.max(0, alturaPixels));
    const g = 9.81;

    return bola.masa * g * h;
}

function calcularEnergiaK(velocidad) {
    return 0.5 * bola.masa * velocidad * velocidad
}

function actualizarEnergia() {
    let ep = 0, ek = 0, ee = 0;

    // Si la velocidad es prácticamente cero, forzar todo a cero
  if (Math.abs(bola.velocidad) < EPS) {
    bola.velocidad = 0;
    ekDisplay.textContent = "0.00 J";
    epDisplay.textContent = "0.00 J";
    eeDisplay.textContent = "0.00 J";
    etDisplay.textContent = "0.00 J";
    
    // Para modelo 5, asegurar que energía perdida = energía inicial
    if (modeloActual === 5) {
      bola.energiaPerdida = bola.energiaInicial;
    }
    
    const elost = bola.energiaPerdida || 0;
    elostDisplay.textContent = elost.toFixed(2) + " J";
    return;
  }

    // Si estamos mostrando la transferencia visual en modelo 5 -> forzamos la UI
    if (modeloActual === 5 && mostrarTransferencia) {
        ep = 0;
        ek = 0; // mostrado como 0 por 1 frame
        ee = energiaCineticaAntes || 0;
        const et = ep + ek + ee;
        const elost = 0;

        epDisplay.textContent = ep.toFixed(2) + " J";
        ekDisplay.textContent = ek.toFixed(2) + " J";
        etDisplay.textContent = et.toFixed(2) + " J";
        eeDisplay.textContent = ee.toFixed(2) + " J";
        elostDisplay.textContent = elost.toFixed(2) + " J";
        return;
    }

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
            ek = bola.energiaInicial - ep - ee - (bola.energiaPerdida || 0);
        }
        if (ek < 0) ek = 0;
    }

    if (modeloActual === 1 || modeloActual === 2 || modeloActual === 5) {
        ek = calcularEnergiaK(bola.velocidad);
    }

    const et = ep + ek + ee;
    let elost = 0;

    // base: pérdidas acumuladas por rozamiento (si están presentes)
    elost += (bola.energiaPerdida || 0);

    // además, si tenemos un estado con energiaInicial conocida (modelos 2 y 4),
    // puede haber otra diferencia entre la energía inicial y la suma actual que
    // no esté registrada en energiaPerdida (p. ej. modelado idealizado).
    if (modeloActual === 2 || modeloActual === 4) {
        const diferencia = Math.max(0, (bola.energiaInicial || 0) - (ep + ek + ee));
        // evitamos doble contarlo: restamos lo que ya acumulamos por rozamiento
        const extra = Math.max(0, diferencia - (bola.energiaPerdida || 0));
        elost += extra;
    }

    epDisplay.textContent = ep.toFixed(2) + " J";
    ekDisplay.textContent = ek.toFixed(2) + " J";
    etDisplay.textContent = et.toFixed(2) + " J";
    eeDisplay.textContent = ee.toFixed(2) + " J";
    elostDisplay.textContent = elost.toFixed(2) + " J";

    contadorFrames++;
    if (contadorFrames % 3 === 0) {
        const posicionMetros = pixelsAMetros(bola.x);
        datosGrafico.posiciones.push(posicionMetros);
        datosGrafico.ep.push(ep);
        datosGrafico.ek.push(ek);
        datosGrafico.ee.push(ee);
        datosGrafico.elost.push(elost);
        datosGrafico.et.push(et);
    }
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
    const altura = alturaRampaMetros * 100; // Convertir metros a pixels

    if (x <= 0) return yBase - altura;
    if (x >= rampaLargo) return yBase; // ← Quitar el +20

    const t = x / rampaLargo;

    return (yBase - altura) + (1 - (1 - t)*(1 - t)) * altura; // ← Quitar el +20
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

    datosGrafico = {
        posiciones: [],
        ep: [],
        ek: [],
        ee: [],
        elost: [],
        et: []
    };
    contadorFrames = 0;
    document.getElementById('grafico-container').style.display = 'none';

    if (modeloActual === 1 || modeloActual === 2) {
        bola = {
            x: 11, y: PISO_Y - radio, radio, masa,
            velocidad: velocidadIn,
            distanciaRecorrida: 0,
            energiaInicial: 0.5 * masa * velocidadIn * velocidadIn,
            energiaFinal: 0,
            longitudTotal: distancia * 30,
            trail: [],
            energiaPerdida: 0
        };
    }

    else if (modeloActual === 3) {
        const altura = parseFloat(document.getElementById("altura").value) || 1;
        alturaRampaMetros = altura; // Actualizar la altura global para curvaRampaY
    
        bola = {
            x: 0,
            y: curvaRampaY(0) - radio,
            radio, masa,
            velocidad: 0,
            distanciaRecorrida: 0,
            energiaInicial: masa * 9.81 * altura, // Ahora usa directamente el input
            energiaFinal: 0,
            longitudTotal: 600,
            trail: [],
            energiaPerdida: 0
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
            trail: [],
            energiaPerdida: 0
        };
    }

    else if (modeloActual === 5) {
        const distancia = parseFloat(document.getElementById("distancia").value) || 200;
        const masa = parseFloat(document.getElementById("masa").value) || 1;
        const velocidadIn = parseFloat(document.getElementById("velocidad").value) || 0;

        bola = {
            x: 11, y: PISO_Y - radio, radio, masa,
            velocidad: velocidadIn,
            distanciaRecorrida: 0,
            energiaInicial: 0.5 * masa * velocidadIn * velocidadIn,
            energiaElastica: 0,
            longitudTotal: distancia * 30,
            trail: [],
            inResorte: false,                // si está interactuando con el resorte
            energiaEnResorteTotal: 0,        // energía total "retenida" por el sistema resorte+bola al entrar
            prevCompresionPx: 0,
            ultimaEnergiaTotal: 0,
            energiaPerdida: 0
        };

        rozamientoZona = { inicio: 400, fin: 600 };
    }

    rozamientoZona = { inicio: 350, fin: 450 };

    // reset visual transfer flags
    mostrarTransferencia = false;
    framesTransferencia = 0;
    energiaCineticaAntes = 0;
    entroAlResorte = false;
    velocidadEntradaResorte = 0;
    saliendoDelResorte = false;

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
        ctx.fillRect(-offset, PISO_Y, bola.longitudTotal + offset + 100, 3);
    }

    else if (modeloActual === 2) {
        ctx.fillStyle = "rgb(200,180,150)";
        ctx.fillRect(-offset, PISO_Y, bola.longitudTotal + offset + 100, 3);

        ctx.fillStyle = "red";
        for (let x = rozamientoZona.inicio; x < rozamientoZona.fin; x += 12) {
            ctx.beginPath();
            ctx.arc(x - offset, PISO_Y + 2, 2, 0, Math.PI * 2);
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
        ctx.fillRect(-offset, PISO_Y, bola.longitudTotal + offset + 100, 3);

        ctx.fillStyle = "red";
        for (let x = rozamientoZona.inicio; x < rozamientoZona.fin; x += 12) {
            ctx.beginPath();
            ctx.arc(x - offset, PISO_Y + 2, 2, 0, Math.PI * 2);
            ctx.fill();
        }

        let xFinal = bola.longitudTotal - 80 - offset;
        let yFinal = PISO_Y - 15;
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

function mostrarErrorUI(mensaje) {
    const resultadoP = document.getElementById("resultado");
    resultadoP.textContent = "⚠️ " + mensaje;
    resultadoP.style.color = "yellow"; // O el color de error que prefieras
}

function limpiarErrorUI() {
    const resultadoP = document.getElementById("resultado");
    resultadoP.textContent = "Energía final:";
    resultadoP.style.color = "rgb(248, 108, 61)"; // Vuelve al color original (según tu styles.css)
}

function generarGrafico() {
    // Mostrar el contenedor del gráfico
    document.getElementById('grafico-container').style.display = 'block';
    
    // Destruir gráfico anterior si existe
    if (chartInstance) {
        chartInstance.destroy();
    }

    const ctx = document.getElementById('energyChart').getContext('2d');
    
    // Configurar datasets según el modelo
    const datasets = [];
    
    // Energía Potencial (solo para modelo 3)
    if (modeloActual === 3) {
        datasets.push({
            label: 'Energía Potencial',
            data: datosGrafico.ep,
            borderColor: '#e20a0a',
            backgroundColor: 'rgba(226, 10, 10, 0.1)',
            borderWidth: 2,
            tension: 0.4
        });
    }
    
    // Energía Cinética (todos los modelos)
    datasets.push({
        label: 'Energía Cinética',
        data: datosGrafico.ek,
        borderColor: '#1ce6d8',
        backgroundColor: 'rgba(28, 230, 216, 0.1)',
        borderWidth: 2,
        tension: 0.4
    });
    
    // Energía Elástica (solo modelo 5)
    if (modeloActual === 5) {
        datasets.push({
            label: 'Energía Elástica',
            data: datosGrafico.ee,
            borderColor: '#d642d6',
            backgroundColor: 'rgba(214, 66, 214, 0.1)',
            borderWidth: 2,
            tension: 0.4
        });
    }
    
    // Energía Perdida (modelos 2 y 5)
    if (modeloActual === 2 || modeloActual === 5) {
        datasets.push({
            label: 'Energía Perdida',
            data: datosGrafico.elost,
            borderColor: '#1db457',
            backgroundColor: 'rgba(29, 180, 87, 0.1)',
            borderWidth: 2,
            tension: 0.4
        });
    }
    
    // Energía Total
    datasets.push({
        label: 'Energía Total',
        data: datosGrafico.et,
        borderColor: '#fdcd30',
        backgroundColor: 'rgba(253, 205, 48, 0.1)',
        borderWidth: 3,
        tension: 0.4
    });

    chartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: datosGrafico.posiciones.map(p => p.toFixed(2)),
            datasets: datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    display: true,
                    position: 'top',
                    labels: {
                        color: '#f1f1f1',
                        font: {
                            size: 12
                        }
                    }
                },
                title: {
                    display: false
                }
            },
            scales: {
                x: {
                    title: {
                        display: true,
                        text: 'Posición (m)',
                        color: '#76f7bb',
                        font: {
                            size: 14,
                            weight: 'bold'
                        }
                    },
                    ticks: {
                        color: '#f1f1f1',
                        maxTicksLimit: 15
                    },
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)'
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: 'Energía (J)',
                        color: '#76f7bb',
                        font: {
                            size: 14,
                            weight: 'bold'
                        }
                    },
                    ticks: {
                        color: '#f1f1f1'
                    },
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)'
                    },
                    beginAtZero: true
                }
            }
        }
    });
    
    // Scroll suave hacia el gráfico
    document.getElementById('grafico-container').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// ----------------- Movimiento -----------------
function moverBola() {
    const dt = 0.1;
    const muK = parseFloat(document.getElementById("mu").value);
    const g = 9.81;
    const aceleracionRozamiento = muK * g;
    const rozamiento = (aceleracionRozamiento * dt) / 10;

    // -------- MODELO 5 --------
    if (modeloActual === 5) {
        if (muK >= 0 && muK <= 1) {
          muKvalue = muK;
          limpiarErrorUI();
        } else {
          mostrarErrorUI("El coeficiente de Rozamiento (μk) debe estar entre 0 y 1.");
          return
        }
        // mantener la bola pegada al piso visual
        if (bola) bola.y = PISO_Y - bola.radio;

        const inicioResorte = bola.longitudTotal - 80;
        const maxCompresionPx = 60;
        
        // Constante k mucho más alta para soportar altas velocidades
        const kResorte = 500 + (bola.masa * 20);

        // --- ROZAMIENTO (solo si NO está en contacto con el resorte) ---
        const enZonaRoz = bola.x > rozamientoZona.inicio && bola.x < rozamientoZona.fin;
        
        // Primero manejar el movimiento y luego verificar contacto con resorte
        let nuevaX = bola.x;
        let nuevaVel = bola.velocidad;
        
        // Aplicar rozamiento si está en la zona y no en el resorte
        if (enZonaRoz && bola.x < inicioResorte - 20) {
            const vAntes = nuevaVel;

            // Aplicar rozamiento
            if (nuevaVel > 0) {
                nuevaVel = nuevaVel - rozamiento;
                // Si el rozamiento haría que cambie de dirección, detener completamente
                if (nuevaVel <= 0) {
                    // Calcular la energía que tenía justo antes de detenerse
                    const energiaRestante = 0.5 * bola.masa * vAntes * vAntes;
                    bola.energiaPerdida = (bola.energiaPerdida || 0) + energiaRestante;
                    
                    nuevaVel = 0;
                    bola.velocidad = 0;
                    bola.x = nuevaX;
                    actualizarEnergia();
                    resultado.textContent = `Energía final: 0.00 J`;
                    cancelAnimationFrame(animacionActiva);
                    animacionActiva = null;
                    generarGrafico();
                    return;
                }
            } else if (nuevaVel < 0) {
                nuevaVel = nuevaVel + rozamiento;
                // Si el rozamiento haría que cambie de dirección, detener completamente
                if (nuevaVel >= 0) {
                    // Calcular la energía que tenía justo antes de detenerse
                    const energiaRestante = 0.5 * bola.masa * vAntes * vAntes;
                    bola.energiaPerdida = (bola.energiaPerdida || 0) + energiaRestante;
                    
                    nuevaVel = 0;
                    bola.velocidad = 0;
                    bola.x = nuevaX;
                    actualizarEnergia();
                    resultado.textContent = `Energía final: 0.00 J`;
                    cancelAnimationFrame(animacionActiva);
                    animacionActiva = null;
                    generarGrafico();
                    return;
                }
            }

            // Calcular pérdida de energía si sigue moviéndose
            const vDespues = nuevaVel;
            const dE = 0.5 * bola.masa * (vAntes * vAntes - vDespues * vDespues);
            if (dE > 0) {
                bola.energiaPerdida = (bola.energiaPerdida || 0) + dE;
            }
        }

        // Calcular próxima posición
        nuevaX += nuevaVel * dt * 10;

        // Verificar si va a contactar o está en contacto con el resorte
        const contactoResorte = (nuevaX + bola.radio) >= inicioResorte;

        if (contactoResorte) {
            // 1) ENTRADA AL RESORTE
            if (!entroAlResorte && nuevaVel > 0.1) {
                entroAlResorte = true;
                saliendoDelResorte = false;

                velocidadEntradaResorte = nuevaVel;
                energiaCineticaAntes = 0.5 * bola.masa * velocidadEntradaResorte * velocidadEntradaResorte;

                mostrarTransferencia = true;
                framesTransferencia = 1;
            }

            // Calcular compresión
            let compresionPx = (nuevaX + bola.radio) - inicioResorte;
            
            // Limitar compresión al máximo permitido (pared dura)
            if (compresionPx > maxCompresionPx) {
                compresionPx = maxCompresionPx;
                nuevaX = inicioResorte + maxCompresionPx - bola.radio;
                // Rebotar conservando EXACTAMENTE la magnitud de velocidad de entrada
                nuevaVel = -velocidadEntradaResorte;
                saliendoDelResorte = true;
            } else {
                // Física normal del resorte
                const compresionM = pixelsAMetros(compresionPx);
                const F_resorte = -kResorte * compresionM;
                const a_resorte = F_resorte / bola.masa;

                nuevaVel += a_resorte * dt * 10;
                
                // Detectar punto de máxima compresión e inversión
                if (nuevaVel < -0.1 && !saliendoDelResorte) {
                    saliendoDelResorte = true;
                    // Al salir, asegurar conservación de energía
                    // La velocidad de salida debe tener la misma magnitud que la de entrada
                    nuevaVel = -velocidadEntradaResorte;
                }
            }

            bola.energiaElastica = 0.5 * kResorte * pixelsAMetros(compresionPx) * pixelsAMetros(compresionPx);
            bola.inResorte = true;
        } else {
            // FUERA DEL RESORTE
            if (entroAlResorte && saliendoDelResorte) {
                // Al salir completamente, asegurar que la velocidad sea exactamente la inversa
                nuevaVel = -velocidadEntradaResorte;
                entroAlResorte = false;
                saliendoDelResorte = false;
                bola.energiaElastica = 0;
            }
            bola.inResorte = false;
        }

        // Actualizar posición y velocidad
        bola.x = nuevaX;
        bola.velocidad = nuevaVel;
        bola.y = PISO_Y - bola.radio;
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

        if (bola.x > rozamientoZona.fin && bola.x + bola.radio < 520) {
          bola.energiaElastica = 0;
        }

        if (bola.x > rozamientoZona.inicio && bola.x < rozamientoZona.fin) {
            // acumulamos pérdida causada por esta reducción (similar a model 2/5)
            const vAntes = bola.velocidad;
            if (bola.velocidad > 0) bola.velocidad -= 0.1;
            else bola.velocidad += 0.1;
            if (Math.abs(bola.velocidad) <= 0.1) {
              bola.velocidad = 0
            }
            const vDespues = bola.velocidad;
            const dE = 0.5 * bola.masa * (vAntes * vAntes - vDespues * vDespues);
            if (dE > 0) {
                bola.energiaPerdida = (bola.energiaPerdida || 0) + dE;
            }

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
    // -------- MODELO 2 --------
if (modeloActual === 2) {
    const enZona = bola.x > rozamientoZona.inicio && bola.x < rozamientoZona.fin;
    if (muK >= 0 && muK <= 1) {
      muKvalue = muK;
      limpiarErrorUI();
    } else {
      mostrarErrorUI("El coeficiente de Rozamiento (μk) debe estar entre 0 y 1.");
      return
    }

    if (enZona) {
        const vAntes = bola.velocidad;
        bola.velocidad -= rozamiento;
        if (bola.velocidad <= 0) {  // ← Cambié de < a <=
            bola.velocidad = 0;
            const vDespues = bola.velocidad;
            const dE = 0.5 * bola.masa * (vAntes * vAntes - vDespues * vDespues);
            if (dE > 0) {
                bola.energiaPerdida = (bola.energiaPerdida || 0) + dE;
            }
            
            // ← AGREGUÉ ESTO: Detener animación y mostrar gráfico
            actualizarEnergia();
            resultado.textContent = `Energía final: 0.0 J`;
            cancelAnimationFrame(animacionActiva);
            animacionActiva = null;
            generarGrafico();  // ← Esta es la línea clave
            return;  // ← Salir de la función para detener la animación
        }
        const vDespues = bola.velocidad;
        const dE = 0.5 * bola.masa * (vAntes * vAntes - vDespues * vDespues);
        if (dE > 0) {
            bola.energiaPerdida = (bola.energiaPerdida || 0) + dE;
        }
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

    // --- después de mostrar la energía en la UI, consumimos 1 frame de la transferencia ---
    if (mostrarTransferencia && framesTransferencia > 0) {
        framesTransferencia--;
        if (framesTransferencia <= 0) {
            mostrarTransferencia = false;
        }
    }

    bola.trail.push({ x: bola.x, y: bola.y });
    if (bola.trail.length > 15) bola.trail.shift();

    tiempo += 0.15;

    // si llega al final derecho normal
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
        generarGrafico();
        return;
    }

    // ---- NUEVO: detectar cuando vuelve hacia la izquierda y termina el recorrido ----
    if (modeloActual === 5) {
        // calculamos energía total actual (EP=0 en este modelo de piso plano)
        const ep = 0;
        const ek = 0.5 * bola.masa * bola.velocidad * bola.velocidad;
        const ee = bola.energiaElastica || 0;
        const energiaTotalActual = ep + ek + ee;

        // almacenamos para debug / referencia
        bola.ultimaEnergiaTotal = energiaTotalActual;

        // si vuelve hacia la izquierda y llegó al inicio (x pequeño), mostramos energía final
        if (bola.velocidad < 0 && bola.x <= 15) {
            // si la energía es prácticamente 0 -> mostrar 0
            if (energiaTotalActual < EPS) {
                resultado.textContent = `Energía final: 0.00 J`;
            } else {
                resultado.textContent = `Energía final: ${energiaTotalActual.toFixed(2)} J`;
            }

            // actualizamos la UI final con pérdidas incluidas
            actualizarEnergia();

            cancelAnimationFrame(animacionActiva);
            animacionActiva = null;
            generarGrafico();
            return;
        }
    }

    animacionActiva = requestAnimationFrame(moverBola);
}


function resetParametrosUI() {
    labelAltura.style.display = "block";
    labelVelocidad.style.display = "block";
    labelDistancia.style.display = "block";
    labelMu.style.display = "block";
}


// ----------------- EVENTOS -----------------
btnIniciar.addEventListener("click", () => {
    inicializar();
    if (animacionActiva) cancelAnimationFrame(animacionActiva);
    animacionActiva = requestAnimationFrame(moverBola);
});

btnModelo1.addEventListener("click", () => {
    resetParametrosUI()

    modeloActual = 1;
    btnModelo1.style.backgroundColor = "rgb(100,180,255)";
    labelAltura.style.display = "none";
    labelMu.style.display = "none";
    labelDistancia.style.display = "block";

    btnModelo2.style.backgroundColor = "";
    btnModelo3.style.backgroundColor = "";
    btnModelo4.style.backgroundColor = "";
    btnModelo5.style.backgroundColor = "";

    inicializar();   // coloca bola y valores iniciales
    dibujarEscena(); 
});

btnModelo2.addEventListener("click", () => {
    resetParametrosUI()

    modeloActual = 2;
    btnModelo2.style.backgroundColor = "rgb(100,180,255)";
    labelAltura.style.display = "none";
    labelDistancia.style.display = "block";

    btnModelo1.style.backgroundColor = "";
    btnModelo3.style.backgroundColor = "";
    btnModelo4.style.backgroundColor = "";
    btnModelo5.style.backgroundColor = "";

    inicializar();   // coloca bola y valores iniciales
    dibujarEscena(); 
});

btnModelo3.addEventListener("click", () => {
    resetParametrosUI()

    modeloActual = 3;
    btnModelo3.style.backgroundColor = "rgb(100,180,255)";
    labelAltura.style.display = "block";
    labelVelocidad.style.display = "none";
    labelDistancia.style.display = "none";
    labelMu.style.display = "none";

    btnModelo1.style.backgroundColor = "";
    btnModelo2.style.backgroundColor = "";
    btnModelo4.style.backgroundColor = "";
    btnModelo5.style.backgroundColor = "";

    inicializar();   // coloca bola y valores iniciales
    dibujarEscena(); 
});

//btnModelo4.addEventListener("click", () => {
//   resetParametrosUI()
//
//    modeloActual = 4;
//    btnModelo4.style.backgroundColor = "rgb(100,180,255)";
//    labelAltura.style.display = "block";
//    labelVelocidad.style.display = "none";
//    labelDistancia.style.display = "none";
//    labelMu.style.display = "block";
//
//    btnModelo1.style.backgroundColor = "";
//   btnModelo2.style.backgroundColor = "";
//    btnModelo3.style.backgroundColor = "";
//    btnModelo5.style.backgroundColor = "";
//
//    inicializar();   // coloca bola y valores iniciales
//    dibujarEscena(); 
//});

btnModelo5.addEventListener("click", () => {
    resetParametrosUI()

    modeloActual = 5;
    btnModelo5.style.backgroundColor = "rgb(100,180,255)";
    labelAltura.style.display = "none";
    labelVelocidad.style.display = "block";
    labelDistancia.style.display = "block";
    labelMu.style.display = "block";

    btnModelo1.style.backgroundColor = "";
    btnModelo2.style.backgroundColor = "";
    btnModelo3.style.backgroundColor = "";
    btnModelo4.style.backgroundColor = "";

    inicializar();   // coloca bola y valores iniciales
    dibujarEscena(); 
});

btnModelo1.classList.add("activo");

inicializar();
