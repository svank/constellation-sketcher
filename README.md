# Constellation Sketcher

A small library that animates the drawing of constellations. Originally designed to be a nice thing to watch while waiting on a long-running task (i.e. more than just a spinner).

[Live demo](https://samvankooten.net/constellation_sketcher)

Static screenshot:

![demo image](images/readme_screenshot.png)

## Description

Constellation Sketcher can render constellations either immediately or as an animation, drawing lines from star to star. Animated drawing starts at a randomly-selected star and draws lines to all connected stars, then to all stars connected to those stars, etc... Accurate background stars are included, and all stars flicker!

I learned while building this that there is simply *no* canonical source for what the constellations look like (that is, which stars to connect to which, and even which stars are included at all!). Constellation Sketcher uses the traditional Western constellations as provided in [Stellarium](http://stellarium.org/). The exact positions and magnitudes of stars are drawn from the [catalog](https://ui.adsabs.harvard.edu/abs/1997A%26A...323L..49P) produced by ESA's [Hipparcos](https://www.cosmos.esa.int/web/hipparcos) mission.

The library weighs in at about 100 kb, most of which is stellar data.

## Use

When started, Constellation Sketcher looks for a `<canvas>` element with `id="constellation-sketcher"`, the size of which can be set through its `width` and `height` attributes. Constellation Sketcher supports drawing to only one canvas at a time.

Drawing can be started via either of two functions:

* `ConstellationSketcher.sketch()` will draw one constellation.

* `ConstellationSketcher.slideshow()` will draw constellations one after the other, with a short pause in between. The slideshow will start with the currently-configured constellation and select random constellations after.

Constellation Sketcher can be configured through a set of functions. Each configuration function returns `ConstellationSketcher` so that calls can be chained (e.g. `ConstellationSketcher.chooseRandomConstellation().setAnimated(false).sketch()`). Configuration values are only guaranteed to affect future calls to `sketch()` or `slideshow()` and may but are not guaranteed to affect any animations currently in progress.

* `ConstellationSketcher.setConstellation(constellation)`: Sets the name of the constellation that will be drawn next.

* `ConstellationSketcher.chooseRandomConstellation()`: Randomly selects the next constellation to be drawn.

* `ConstellationSketcher.getConstellation()`: Returns the name of the last constellation set.

* `ConstellationSketcher.setAnimated(animated)`: Accepts a boolean. If true, constellations are drawn as an animation. If false, they are drawn immediately upon the start of drawing.

* `ConstellationSketcher.setDrawLines(drawLines)`: Accepts a boolean. If false, lines are not drawn, only stars.

* `ConstellationSketcher.setTwinkle(twinkle)`: Accepts a boolean. If true, stars twinkle.

* `ConstellationSketcher.setTwinkleAmplitude(twinkleAmplitude)`: Accepts a number which multiplies the amount stars change in magnitude when flickering. The default is `1`.

* `ConstellationSketcher.setTwinkleTimescale(twinkleTimescale)`: Accepts a number of milliseconds. This is the time between updates to the twinkle-based changes in stellar magnitude.

* `ConstellationSketcher.setSpeedScale(speedScale)`: Accepts a number which multiplies the speed at which lines grow during animation. The default is `1`.

* `ConstellationSketcher.setSlideshowDwellTime(dwellTime)`: Accepts a number of milliseconds. This is the length of the pause during slideshows between the end of drawing one constellation and the beginning of drawing the next.

* `ConstellationSketcher.setDrawBeginCallback(drawBeginCallback)`: Accepts a function which is called at the beginning of drawing a constellation. The callback function is provided as an argument a CanvasRenderingContext2D for drawing to the canvas.

* `ConstellationSketcher.setDrawFrameCompleteCallback(drawFrameCompleteCallback)`: Accepts a function which is called at the end of drawing each frame. The callback function is provided as arguments a CanvasRenderingContext2D for drawing to the canvas and a boolean indicating whether the whole canvas was cleared and redrawn this frame.

* `ConstellationSketcher.setDrawCompleteCallback(drawCompleteCallback)`: Accepts a function which is called at the end of drawing a constellation. The callback function is provided as an argument a CanvasRenderingContext2D for drawing to the canvas.