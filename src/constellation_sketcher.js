import constellationData from "./constellation_data.json";
import {randomChoice, extractLinesAtPoint} from './constellation_sketcher_utils.js';

const state = {
    mode: null,
    superMode: "",
    constellation: "Orion",
    animated: true,
    drawLines: true,
    twinkle: true,
    twinkleTimescale: 60,
    twinkleAmplitude: 1,
    speedScale: 1,
    slideshowDwellTime: 4000,
    slideshowTimeout: null,
    drawBeginCallback: null,
    drawFrameCompleteCallback: null,
    drawCompleteCallback: null,
    stars: null,
    twinkeDeltaMags: null,
    modeState: null,
};

export function setConstellation(constellation) {
    state.constellation = constellation;
    return this;
}

export function chooseRandomConstellation() {
    state.constellation = randomChoice(constellationNames);
    return this;
}

export const getConstellation = () => state.constellation;

export function setAnimated(animated) {
    state.animated = animated;
    return this;
}

export function setDrawLines(drawLines) {
    state.drawLines = drawLines;
    return this;
}

export function setTwinkle(twinkle) {
    state.twinkle = twinkle;
    return this;
}

export function setTwinkleAmplitude(twinkleAmplitude) {
    state.twinkleAmplitude = twinkleAmplitude;
    return this;
}

export function setTwinkleTimescale(twinkleTimescale) {
    state.twinkleTimescale = twinkleTimescale;
    return this;
}

export function setSpeedScale(speedScale) {
    state.speedScale = speedScale;
    return this;
}

export function setSlideshowDwellTime(dwellTime) {
    state.slideshowDwellTime = dwellTime;
    return this;
}

export function setDrawBeginCallback(drawBeginCallback) {
    state.drawBeginCallback = drawBeginCallback;
    return this;
}

export function setDrawFrameCompleteCallback(drawFrameCompleteCallback) {
    state.drawFrameCompleteCallback = drawFrameCompleteCallback;
    return this;
}

export function setDrawCompleteCallback(drawCompleteCallback) {
    state.drawCompleteCallback = drawCompleteCallback;
    return this;
}

export function sketch() {
    setup();
    state.superMode = "";
    startSketch();
}

export function slideshow() {
    setup();
    state.superMode = "slideshow";
    startSlideshow();
}

function setup() {
    if (state.slideshowTimeout !== null) {
        clearTimeout(state.slideshowTimeout);
        state.slideshowTimeout = null;
    }
    
    if (state.mode === null) {
        let canvas = document.getElementById("constellation-sketcher");
        state.ctx = canvas.getContext('2d');
        state.width = canvas.width;
        state.height = canvas.height;
        state.padding = .1 * state.width;
        state.mode = "waiting";
    }
    clearCanvas();
}

function clearCanvas() {
    state.ctx.fillStyle = 'rgb(0, 0, 0)';
    state.ctx.strokeStyle = 'rgba(255, 0, 0, 0)';
    state.ctx.fillRect(0, 0, state.width, state.height);
}

function startSlideshow() {
    state.slideshowTimeout = null;
    clearCanvas();
    startSketch();
}

function startSketch() {
    if (state.drawBeginCallback instanceof Function)
        state.drawBeginCallback(state.ctx);
    
    const cdat = constellationData[state.constellation];
    const sx = (x) => x/1000 * (state.width - 2 * state.padding) + state.padding;
    const sy = (y) => y/1000 * (state.height - 2 * state.padding) + state.padding;
    const sv = (v) => v/10
    
    state.twinkleTimestamp = performance.now();
    state.stars = [];
    state.twinkeDeltaMags = [];
    for (let i=0; i<cdat.stars.x.length; i++) {
        const data = [sx(cdat.stars.x[i]),
                      sy(cdat.stars.y[i]),
                      sv(cdat.stars.Vmag[i])]
        state.stars.push(data);
        state.twinkeDeltaMags.push(0);
        drawStar(...data);
    }
    
    const lines = [];
    if (state.drawLines) {
        for (let i = 0; i < cdat.lines.start.length; i++) {
            lines.push({
                x1: sx(cdat.stars.x[cdat.lines.start[i]]),
                y1: sy(cdat.stars.y[cdat.lines.start[i]]),
                x2: sx(cdat.stars.x[cdat.lines.stop[i]]),
                y2: sy(cdat.stars.y[cdat.lines.stop[i]]),
            });
        }
    }
    
    if (state.animated && state.drawLines) {
        const startLine = randomChoice(lines);
        let [startLines, linesToDraw] = extractLinesAtPoint(lines, startLine.x1, startLine.y1);
        
        // Special case for the only non-contiguous constellation
        if (state.constellation === "Serpens") {
            // With x = sx(700) as the dividing line, choose a second starting
            // point in the other half of the constellation
            let secondStartLine = randomChoice(lines);
            const line = 0.7 * state.width;
            while ((startLine.x1 > line && secondStartLine.x1 > line)
                    || (startLine.x1 < line && secondStartLine.x1 < line))
                secondStartLine = randomChoice(lines);
            let extraStartLines;
            [extraStartLines, linesToDraw] = extractLinesAtPoint(linesToDraw, secondStartLine.x1, secondStartLine.y1);
            startLines.push(...extraStartLines);
        }
        
        state.modeState = {
            linesToDraw: linesToDraw,
            linesDrawing: startLines,
            linesFinished: []
        };
        
        startAnimatingALine();
    } else {
        state.modeState = {
            linesToDraw: [],
            linesDrawing: [],
            linesFinished: lines
        };
        lines.forEach((line) => {
            drawLine(line.x1, line.x2, line.y1, line.y2);
        });
        onSketchEnd();
    }
}

function onSketchEnd() {
    state.mode = "waiting";
    if (state.drawCompleteCallback instanceof Function)
        state.drawCompleteCallback(state.ctx);
    sketchIsEnded();
}

function sketchIsEnded() {
    if (state.mode === "waiting" && state.twinkle) {
        redrawField();
        window.requestAnimationFrame(sketchIsEnded)
    }
    if (state.superMode === "slideshow"
        && state.mode === "waiting"
        && state.slideshowTimeout === null) {
        state.slideshowTimeout = setTimeout(() => {
            chooseRandomConstellation();
            startSlideshow();
        }, state.slideshowDwellTime);
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
    
    let oldFraction = state.modeState.fraction;
    let newFraction = (timestamp - state.modeState.aniStart) / state.modeState.aniDuration;
    if (newFraction > 1) newFraction = 1;
    if (newFraction < oldFraction) newFraction = oldFraction;
    state.modeState.fraction = newFraction;
    
    let redrew = false;
    if (state.twinkle && twinkleTimeout()) {
        redrawField();
        oldFraction = 0;
        redrew = true;
    }
    
    state.modeState.linesDrawing.forEach((line) => {
        const dx = line.x2 - line.x1;
        const dy = line.y2 - line.y1;
        const x1 = line.x1 + dx * oldFraction;
        const x2 = x1 + dx * (newFraction - oldFraction);
        const y1 = line.y1 + dy * oldFraction;
        const y2 = y1 + dy * (newFraction - oldFraction);
        drawLine(x1, x2, y1, y2)
    });
    
    if (state.drawFrameCompleteCallback instanceof Function)
        state.drawFrameCompleteCallback(state.ctx, redrew);
    
    if (newFraction >= 1) {
        let lines = state.modeState.linesToDraw;
        let linesDrawing = [];
        state.modeState.linesFinished.push(...state.modeState.linesDrawing);
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
        else
            onSketchEnd();
    } else
        window.requestAnimationFrame(drawLineFrame)
}

function twinkleTimeout() {
    return performance.now() - state.twinkleTimestamp > state.twinkleTimescale;
}

function redrawField() {
    clearCanvas();
    if (twinkleTimeout()) {
        state.twinkeDeltaMags = state.stars.map((data) => {
            const mag = data[2];
            if (mag < 6)
                return (10 - mag)
                    * (Math.random() * 0.15 - 0.075)
                    * state.twinkleAmplitude;
            return 0;
        });
        state.twinkleTimestamp = performance.now();
    }
    state.stars.forEach((data, idx) => {
        let [x, y, mag] = data;
        mag += state.twinkeDeltaMags[idx];
        drawStar(x, y, mag);
    });
    state.modeState.linesFinished.forEach((line) => {
        drawLine(line.x1, line.x2, line.y1, line.y2);
    });
}

function drawStar(x, y, Vmag) {
    const r = (7 - Vmag) / 4 + .5;
    const opac = 1 - .15 * (Vmag-1)
    state.ctx.beginPath();
    state.ctx.fillStyle = `rgba(255,255,255,${opac})`;
    state.ctx.arc(x, y, r, 0, Math.PI * 2);
    state.ctx.fill();
}

function drawLine(x1, x2, y1, y2) {
    state.ctx.beginPath();
    state.ctx.strokeStyle = 'rgba(255,245,219,.4)';
    state.ctx.lineWidth = 2;
    state.ctx.moveTo(x1, y1);
    state.ctx.lineTo(x2, y2);
    state.ctx.stroke()
}

export const constellationNames = Object.keys(constellationData);