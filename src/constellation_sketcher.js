import constellationData from "./constellation_data.json";
import {randomChoice, extractLinesAtPoint} from './constellation_sketcher_utils.js';

const state = {
    mode: "waiting",
    constellation: "Orion",
    animated: true,
    speedScale: 1,
};

export function setConstellation(constellation) {
    state.constellation = constellation;
    return this;
}

export function setAnimated(animated) {
    state.animated = animated;
    return this;
}

export function setSpeedScale(speedScale) {
    state.speedScale = speedScale;
    return this;
}

export function sketch() {
    let canvas = document.getElementById("constellation-sketcher");
    state.ctx = canvas.getContext('2d');
    state.width = canvas.width;
    state.height = canvas.height;
    state.padding = .1 * state.width;
    
    state.ctx.fillStyle = 'rgb(0, 0, 0)';
    state.ctx.strokeStyle = 'rgba(255, 0, 0, 0)';
    state.ctx.fillRect(0, 0, state.width, state.height);
    
    startSketch();
}

function startSketch() {
    const cdat = constellationData[state.constellation];
    const sx = (x) => x/1000 * (state.width - 2 * state.padding) + state.padding;
    const sy = (y) => y/1000 * (state.height - 2 * state.padding) + state.padding;
    const sv = (v) => v/10
    
    for (let i=0; i<cdat.stars.x.length; i++) {
        draw_star(sx(cdat.stars.x[i]),
                  sy(cdat.stars.y[i]),
                  sv(cdat.stars.Vmag[i]));
    }
    
    const lines = [];
    for (let i=0; i<cdat.lines.start.length; i++) {
        lines.push({x1: sx(cdat.stars.x[cdat.lines.start[i]]),
                    y1: sy(cdat.stars.y[cdat.lines.start[i]]),
                    x2: sx(cdat.stars.x[cdat.lines.stop[i]]),
                    y2: sy(cdat.stars.y[cdat.lines.stop[i]]),
        });
    }
    
    if (state.animated) {
        const startLine = randomChoice(lines);
        const [startLines, linesToDraw] = extractLinesAtPoint(lines, startLine.x1, startLine.y1);
        state.modeState = {
            linesToDraw: linesToDraw,
            linesDrawing: startLines
        };
        
        startAnimatingALine();
    } else {
        lines.forEach((line) => {
            draw_line(line.x1, line.x2, line.y1, line.y2);
        });
        state.mode = "waiting";
    }
}

/**
 * Prepares to draw one line or set of lines as part of an animation.
 * 
 * The main role of this function is to determine the speed at which the lines
 * are drawn, which is scaled by the length of the longest line so that lines
 * always grow at a ~constant rate. state.modeState is configured according
 * to the speed that is selected.
 */
function startAnimatingALine() {
    const lengths = state.modeState.linesDrawing.map((line) => (
        Math.sqrt(Math.pow((line.x2-line.x1)/state.width, 2)
            + Math.pow((line.y2-line.y1)/state.height, 2))
    ));
    
    state.modeState.fraction = 0;
    state.modeState.aniStart = performance.now();
    state.modeState.aniDuration = Math.max(...lengths) * 7000 / state.speedScale;
    
    // Don't schedule a frame draw if other things are already going on.
    if (state.mode === "waiting") {
        state.mode = "drawing_lines";
        window.requestAnimationFrame(drawLineFrame);
    }
}

/**
 * Called through window.requestAnimationFrame, completes one frame of
 * animation when drawing lines.
 */
function drawLineFrame(timestamp) {
    if (state.mode !== "drawing_lines")
        return;
    
    const oldFraction = state.modeState.fraction;
    let newFraction = (timestamp - state.modeState.aniStart) / state.modeState.aniDuration;
    if (newFraction > 1) newFraction = 1;
    if (newFraction < oldFraction) newFraction = oldFraction;
    state.modeState.fraction = newFraction;
    
    state.modeState.linesDrawing.forEach((line) => {
        const dx = line.x2 - line.x1;
        const dy = line.y2 - line.y1;
        const x1 = line.x1 + dx * oldFraction;
        const x2 = x1 + dx * (newFraction - oldFraction);
        const y1 = line.y1 + dy * oldFraction;
        const y2 = y1 + dy * (newFraction - oldFraction);
        draw_line(x1, x2, y1, y2)
    });
    
    if (newFraction >= 1) {
        let lines = state.modeState.linesToDraw;
        let linesDrawing = [];
        state.modeState.linesDrawing.forEach((line) => {
            let newLinesDrawing;
            [newLinesDrawing, lines] = extractLinesAtPoint(lines, line.x2, line.y2);
            linesDrawing.push(...newLinesDrawing);
        });
        state.modeState.linesToDraw = lines;
        state.modeState.linesDrawing = linesDrawing;
        state.mode = "waiting";
        if (state.modeState.linesDrawing.length > 0)
            startAnimatingALine();
    } else
        window.requestAnimationFrame(drawLineFrame)
}

function draw_star(x, y, Vmag) {
    const r = (7 - Vmag) / 4 + .5;
    const opac = 1 - .15 * (Vmag-1)
    state.ctx.beginPath();
    state.ctx.fillStyle = `rgba(255,255,255,${opac})`;
    state.ctx.arc(x, y, r, 0, Math.PI * 2);
    state.ctx.fill();
}

function draw_line(x1, x2, y1, y2) {
    state.ctx.beginPath();
    state.ctx.strokeStyle = 'rgba(255,245,219,.4)';
    state.ctx.lineWidth = 2;
    state.ctx.moveTo(x1, y1);
    state.ctx.lineTo(x2, y2);
    state.ctx.stroke()
}

export const constellationNames = Object.keys(constellationData);