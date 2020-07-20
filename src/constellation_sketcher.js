import constellationCategories from "./constellation_categories.json";
import constellationData from "./constellation_data.json";
import {randomChoice, randomWeightedChoice, extractLinesAtPoint} from './constellation_sketcher_utils.js';

const state = {
    // Configurable values
    nextConstellation: "Orion",
    animated: true,
    drawLines: true,
    twinkle: true,
    twinkleTimescale: 70,
    twinkleAmplitude: 1,
    speedScale: 1,
    sizeScale: 1,
    slideshow: false,
    slideshowDwellTime: 4000,
    fadeIn: false,
    crossFade: true,
    fadeInTime: 750,
    crossFadeTime: 750,
    weights: {popular: 2, striking: 2, medium: 1, small: 0},
    
    // User-provided callbacks
    drawBeginCallback: null,
    drawFrameCompleteCallback: null,
    drawCompleteCallback: null,
    
    // Internal state
    mode: "uninitialized",
    drawState: null,
    oldDrawState: null,
    fadeState: null,
    recentConstellations: [],
    canvasScale: null,
    slideshowTimeout: null,
    frameRequest: null,
};

// Store a copy of the default config
const defaults = Object.assign({}, state);
// Ensure `weights` is an independent copy
defaults.weights = JSON.parse(JSON.stringify(state.weights));



/**
 * Functions for configuring state
*/



export function setConstellation(constellation) {
    state.nextConstellation = constellation;
    return this;
}

export function chooseRandomConstellation() {
    const weights = {};
    for (const category in constellationCategories) {
        const weight = state.weights[category];
        for (const constellation of constellationCategories[category])
            weights[constellation] = Math.max(
                weights[constellation] || 0, weight);
    }
    
    // Don't repeat recent constellations
    state.recentConstellations.forEach(
        (constellation) => weights[constellation] = 0);
    
    state.nextConstellation = randomWeightedChoice(weights);
    return this;
}

export const getConstellation = () =>
    state.drawState === null ? null : state.drawState.constellation;

export const getNextConstellation = () => state.nextConstellation;

export function setAnimated(animated) {
    state.animated = animated;
    return this;
}

export function setDrawLines(drawLines) {
    state.drawLines = drawLines;
    return this;
}

export function setTwinkle(twinkle) {
    // If twinkle is enabled after a constellation is drawn, start twinkling
    if (twinkle && !state.twinkle && state.mode === "waiting")
        state.frameRequest = window.requestAnimationFrame(sketchIsEnded);
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

export function setSizeScale(sizeScale) {
    state.sizeScale = sizeScale;
    return this;
}

export function setCrossFade(doCrossFade, crossFadeTime) {
    if (doCrossFade !== undefined)
        state.crossFade = doCrossFade;
    if (crossFadeTime !== undefined)
        state.crossFadeTime = crossFadeTime;
    return this;
}

export function setFadeIn(doFadeIn, fadeInTime) {
    if (doFadeIn !== undefined)
        state.fadeIn = doFadeIn;
    if (fadeInTime !== undefined)
        state.fadeInTime = fadeInTime;
    return this;
}

export function setSlideshowDwellTime(dwellTime) {
    state.slideshowDwellTime = dwellTime;
    return this;
}

export function setSelectionWeightsAll(weight) {
    for (let key in state.weights)
        state.weights[key] = weight;
    return this;
}

export function setSelectionWeightPopular(weight) {
    state.weights.popular = weight;
    return this;
}

export function setSelectionWeightStriking(weight) {
    state.weights.striking = weight;
    return this;
}

export function setSelectionWeightMedium(weight) {
    state.weights.medium = weight;
    return this;
}

export function setSelectionWeightSmall(weight) {
    state.weights.small = weight;
    return this;
}

export function setDrawBeginCallback(drawBeginCallback) {
    state.drawBeginCallback =
        (ctx) => drawBeginCallback(ctx, state.drawState.constellation);
    return this;
}

export function setDrawFrameCompleteCallback(drawFrameCompleteCallback) {
    state.drawFrameCompleteCallback =
        (ctx, redrew) =>
            drawFrameCompleteCallback(
                ctx, redrew, state.drawState.constellation);
    return this;
}

export function setDrawCompleteCallback(drawCompleteCallback) {
    state.drawCompleteCallback =
        (ctx) => drawCompleteCallback(ctx, state.drawState.constellation);
    return this;
}



/**
 * Functions for controlling ConstellationSketcher
*/



export function sketch() {
    state.slideshow = false;
    setup();
    if (state.mode !== "waiting" && state.mode !== "uninitialized")
        return;
    startSketch();
}

export function slideshow() {
    state.slideshow = true;
    setup();
    if (state.mode !== "waiting" && state.mode !== "uninitialized")
        return;
    startSlideshow();
}

export function stop() {
    state.mode = "waiting";
    if (state.frameRequest !== null) {
        window.cancelAnimationFrame(state.frameRequest);
        state.frameRequest = null;
        state.fadeState = null;
        state.oldDrawState = null;
    }
    if (state.slideshowTimeout !== null) {
        clearTimeout(state.slideshowTimeout);
        state.slideshowTimeout = null;
    }
}

export function reset() {
    stop();
    Object.assign(state, defaults);
    state.weights = JSON.parse(JSON.stringify(defaults.weights));
}



/**
 * Internal functions
*/



function setup() {
    if (state.slideshowTimeout !== null) {
        clearTimeout(state.slideshowTimeout);
        state.slideshowTimeout = null;
    }
    
    if (state.mode === "uninitialized") {
        let canvas = document.getElementById("constellation-sketcher");
        state.ctx = canvas.getContext('2d');
        state.width = canvas.width;
        state.height = canvas.height;
        state.canvasScale = Math.max(state.width, state.height);
        state.padding = .1 * state.width;
        state.mode = "waiting";
    }
}

function clearCanvas() {
    state.ctx.fillStyle = 'rgb(0, 0, 0)';
    state.ctx.fillRect(0, 0, state.width, state.height);
}

function startSlideshow() {
    state.slideshowTimeout = null;
    startSketch();
}

function startSketch() {
    // Track recent constellations
    state.recentConstellations.push(state.nextConstellation);
    if (state.recentConstellations.length > 6)
        state.recentConstellations.shift();
    
    state.oldDrawState = state.drawState;
    
    state.drawState = {
        constellation: state.nextConstellation,
        linesToDraw: [],
        linesDrawing: [],
        linesFinished: [],
        stars: [],
        twinkleDeltaMags: [],
        fraction: 0,
        aniStart: 0,
        aniDuration: 0,
        twinkleTimestamp: performance.now(),
    };
    
    if (state.slideshow)
        chooseRandomConstellation();
    else
        state.nextConstellation = null;
    
    if (state.drawBeginCallback instanceof Function)
        state.drawBeginCallback(state.ctx);
    
    const cdat = constellationData[state.drawState.constellation];
    // Functions which properly scale positions and magnitudes
    const sx = (x) => (x/1000 * (state.canvasScale - 2 * state.padding)
                       + state.padding
                       + (state.width - state.canvasScale)/2);
    const sy = (y) => (y/1000 * (state.canvasScale - 2 * state.padding)
                       + state.padding
                       + (state.height - state.canvasScale)/2);
    const sv = (v) => v/10
    
    for (let i=0; i<cdat.stars.x.length; i++) {
        const data = [sx(cdat.stars.x[i]),
                      sy(cdat.stars.y[i]),
                      sv(cdat.stars.Vmag[i])]
        state.drawState.stars.push(data);
        state.drawState.twinkleDeltaMags.push(0);
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
        const [startLines, linesToDraw] = extractLinesAtPoint(
            lines, startLine.x1, startLine.y1);
        state.drawState.linesToDraw = linesToDraw;
        state.drawState.linesDrawing = startLines;
    } else
        state.drawState.linesFinished = lines;
    
    if ((state.oldDrawState === null && state.fadeIn)
            || (state.oldDrawState !== null && state.crossFade))
        fadeIn();
    else {
        state.mode = "waiting";
        if (state.animated && state.drawLines)
            startAnimatingALine();
        else {
            redrawField();
            onSketchEnd();
        }
    }
}

/**
 * Draws one frame in a fade-in animation. Requests that it be called
 * again if appropriate. Includes handling for setting up the fade
 * on the first frame and for moving along after the last frame.
 * 
 * Handles both an initial fade-in from a transparent canvas and
 * cross-fades from one constellation to another.
 */
function fadeIn(timestamp) {
    let fadeIsStarting = false;
    if (state.fadeState === null) {
        fadeIsStarting = true;
        // This is the first time through this function and the
        // beginning of the fade.
        state.mode = "fading";
        timestamp = performance.now();
        const canvas = document.createElement("canvas");
        canvas.width = state.width;
        canvas.height = state.height;
        state.fadeState = {
            aniStart: timestamp,
            accumulatedOpacity: 0,
            buffer: canvas,
            bufferCtx: canvas.getContext("2d"),
            mainCtx: state.ctx,
            mainDrawState: state.drawState,
        };
    } else if (state.mode !== "fading")
        // The fade has been interrupted
        return;
    
    // We only need to redraw everything from scratch when the stars twinkle,
    // which isn't every frame. So we draw the old constellation on the main
    // canvas and the new constellation on a buffer canvas which is drawn onto
    // the main canvas with transparency, and on non-twinkle frames we just
    // redraw that buffer to achieve the required opacity level.
    if (twinkleIsTimedOut() || fadeIsStarting) {
        state.fadeState.accumulatedOpacity = 0;
        if (state.oldDrawState === null)
            // We're fading in from transparent
            state.ctx.clearRect(0, 0, state.width, state.height);
        else {
            // We're cross-fading from a previous constellation.
            // We redraw that constellation here
            state.drawState = state.oldDrawState;
            drawLineFrame(timestamp);
            state.drawState = state.fadeState.mainDrawState;
        }
        // Update the new star field in the buffer
        state.ctx = state.fadeState.bufferCtx;
        drawLineFrame(state.drawState.aniStart);
        state.ctx = state.fadeState.mainCtx;
    }
    
    // We'll draw the incoming constellation with a time-varying
    // global alpha value.
    const aniDuration = state.oldDrawState === null
                         ? state.fadeInTime
                         : state.crossFadeTime;
    let targetOpac = (timestamp - state.fadeState.aniStart) / aniDuration;
    if (targetOpac > 1) targetOpac = 1;
    if (targetOpac < 0) targetOpac = 0;
    // Calculate what opacity we have to draw with to reach our target
    // opacity, given what's already been drawn.
    const opac = (targetOpac - state.fadeState.accumulatedOpacity)
                  / (1 - state.fadeState.accumulatedOpacity);
    
    state.ctx.globalAlpha = opac;
    state.ctx.drawImage(state.fadeState.buffer, 0, 0);
    state.ctx.globalAlpha = 1;
    state.fadeState.accumulatedOpacity = targetOpac;
    
    if (targetOpac >= 1) {
        state.fadeState = null;
        state.oldDrawState = null;
        state.mode = "waiting";
        state.frameRequest = window.requestAnimationFrame(
            state.animated && state.drawLines
                ? startAnimatingALine
                : onSketchEnd);
    } else {
        state.frameRequest = window.requestAnimationFrame(fadeIn);
    }
}

/**
 * Handles one-off activities after a sketch is completed.
 */
function onSketchEnd() {
    state.mode = "waiting";
    if (state.drawCompleteCallback instanceof Function)
        state.drawCompleteCallback(state.ctx);
    sketchIsEnded();
}

/**
 * Provides an "idle loop" after sketching has ended. Schedules calls
 * to itself to ensure stars continue to twinkle. Queues up another
 * constellation after the appropriate delay if in slideshow mode.
 */
function sketchIsEnded() {
    if (state.mode === "waiting" && state.twinkle) {
        if (twinkleIsTimedOut()) {
            redrawField();
            if (state.drawFrameCompleteCallback instanceof Function)
                state.drawFrameCompleteCallback(state.ctx, true);
        }
        state.frameRequest = window.requestAnimationFrame(sketchIsEnded)
    }
    if (state.slideshow
        && state.mode === "waiting"
        && state.slideshowTimeout === null) {
        state.slideshowTimeout = setTimeout(() => {
            startSlideshow();
        }, state.slideshowDwellTime);
    }
}

/**
 * Prepares to draw one line or set of lines as part of an animation.
 * 
 * The main role of this function is to determine the speed at which the lines
 * are drawn, which is scaled by the length of the longest line so that lines
 * always grow at a ~constant rate. state.drawState is configured according
 * to the speed that is selected.
 */
function startAnimatingALine() {
    const lengths = state.drawState.linesDrawing.map((line) => (
        Math.sqrt(Math.pow((line.x2-line.x1)/state.canvasScale, 2)
            + Math.pow((line.y2-line.y1)/state.canvasScale, 2))
    ));
    
    state.drawState.fraction = 0;
    state.drawState.aniStart = performance.now();
    state.drawState.aniDuration = Math.max(...lengths) * 4000/state.speedScale;
    
    // Don't schedule a frame draw if other things are already going on.
    if (state.mode === "waiting") {
        state.mode = "drawing_lines";
        state.frameRequest = window.requestAnimationFrame(drawLineFrame);
    }
}

/**
 * Called through window.requestAnimationFrame, completes one frame of
 * animation when drawing lines. Will enqueue another call to this function
 * for the next frame or advance the sketching state, as appropriate.
 */
function drawLineFrame(timestamp) {
    if (state.mode !== "drawing_lines" && state.mode !== "fading")
        return;
    
    let oldFraction = state.drawState.fraction;
    let newFraction = ((timestamp - state.drawState.aniStart)
                       / state.drawState.aniDuration);
    if (newFraction > 1) newFraction = 1;
    if (newFraction < oldFraction) newFraction = oldFraction;
    state.drawState.fraction = newFraction;
    
    let redrew = false;
    if ((state.twinkle && twinkleIsTimedOut()) || state.mode === "fading") {
        redrawField();
        oldFraction = 0;
        redrew = true;
    }
    
    state.drawState.linesDrawing.forEach((line) => {
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
    
    if (newFraction >= 1 && state.mode !== "fading") {
        let lines = state.drawState.linesToDraw;
        let linesDrawing = [];
        state.drawState.linesFinished.push(...state.drawState.linesDrawing);
        state.drawState.linesDrawing.forEach((line) => {
            let newLinesDrawing;
            [newLinesDrawing, lines] = extractLinesAtPoint(
                lines, line.x2, line.y2);
            linesDrawing.push(...newLinesDrawing);
        });
        if (linesDrawing.length === 0 && lines.length > 0) {
            // Handle non-connected constellations (e.g. Crux)
            const startLine = randomChoice(lines);
            [linesDrawing, lines] = extractLinesAtPoint(lines,
                startLine.x1, startLine.y1);
        }
        state.drawState.linesToDraw = lines;
        state.drawState.linesDrawing = linesDrawing;
        state.mode = "waiting";
        if (state.drawState.linesDrawing.length > 0)
            startAnimatingALine();
        else
            onSketchEnd();
    } else
        if (state.mode === "drawing_lines")
            state.frameRequest = window.requestAnimationFrame(drawLineFrame)
}

/**
 * Returns True if stars should be redrawn this frame so they twinkle.
 */
function twinkleIsTimedOut() {
    const dt = performance.now() - state.drawState.twinkleTimestamp;
    return state.twinkle && (dt > state.twinkleTimescale);
}

/**
 * Draws the field from scratch, including the black BG, all the stars,
 * and every constellation line that has already been completed. Star
 * twinkle is updated if appropriate.
 */
function redrawField() {
    clearCanvas();
    if (twinkleIsTimedOut()) {
        state.drawState.twinkleDeltaMags = state.drawState.stars.map((data) =>{
            const mag = data[2];
            return (10 - mag)
                * (Math.random() * 0.15 - 0.075)
                * state.twinkleAmplitude;
        });
        state.drawState.twinkleTimestamp = performance.now();
    }
    state.drawState.stars.forEach((data, idx) => {
        let [x, y, mag] = data;
        mag += state.drawState.twinkleDeltaMags[idx];
        drawStar(x, y, mag);
    });
    state.drawState.linesFinished.forEach((line) => {
        drawLine(line.x1, line.x2, line.y1, line.y2);
    });
}

function drawStar(x, y, Vmag) {
    const r = (7 - Vmag) * state.canvasScale / 2000 * state.sizeScale + 0.5;
    let opac = 1 - .15 * (Vmag-1);
    if (opac > 1) opac = 1;
    if (opac < 0) opac = 0;
    state.ctx.beginPath();
    state.ctx.fillStyle = `rgba(255,255,255,${opac})`;
    state.ctx.arc(x, y, r, 0, Math.PI * 2);
    state.ctx.fill();
}

function drawLine(x1, x2, y1, y2) {
    state.ctx.beginPath();
    state.ctx.strokeStyle = 'rgba(255,239,187,0.4)';
    state.ctx.lineWidth = Math.max(2, 2 * state.canvasScale / 500);
    state.ctx.moveTo(x1, y1);
    state.ctx.lineTo(x2, y2);
    state.ctx.stroke()
}

export const constellationNames = Object.keys(constellationData);
export {constellationCategories as categories};