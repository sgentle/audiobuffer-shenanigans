var context = new (window.AudioContext || window.webkitAudioContext)()

var SAMPLERATE = 48000
var TIME = 1 // Ring buffer time in seconds
var SAMPLES = SAMPLERATE * TIME
var SEGS = 8 // Number of segments to split the buffer into for processing
var SEGSIZE = SAMPLES / SEGS

// Set up the canvas to draw our ghetto oscilloscope to
var canvas = document.querySelector('canvas')
var ctx = canvas.getContext('2d')
var OVERSAMPLE = 8 // Oversampling for the canvas to make the aliasing a bit nicer
var OS_WIDTH = canvas.width * OVERSAMPLE
ctx.fillStyle = 'black'
ctx.scale(1/OVERSAMPLE, canvas.height / 2) //Put us into an easy coordinate system
ctx.translate(0, 1)

// Create audio buffer to act as our ring buffer
var buffer = context.createBuffer(1, SAMPLES, SAMPLERATE)
var samples = buffer.getChannelData(0)

// Set up our initial brownian noise, overlap it a little to decrease the amount of popping
// Based on http://noisehack.com/generate-noise-web-audio-api/
var n = 0
for (var i = 0; i <= SAMPLES; i++) {
  n = n * 0.98 + (Math.random() * 2 - 1) * 0.02
  var gain = 5 * (1 - i / SAMPLES)
  samples[i] = n * gain
}

// We'll use this later
var copy = new Float32Array(samples)

var bsn = context.createBufferSource()
bsn.buffer = buffer
bsn.loop = true
bsn.start(0)
bsn.connect(context.destination)

// Firefox neuters the original sample buffer, so we use our copy
if (samples.length === 0) samples = copy

// Stuff for note generation
var note = 0
var base = 0

// Main loop - fill the buffer ahead of where we're currently playing (hopefully)
var seg = 0
setTimeout(function() {
  setInterval(function() {
    var nextseg = (seg + 1) % SEGS

    // Figure out the note to play, a 5-tet random arpeggio
    var tone = 220 * Math.pow(2, (note + base) / 5)
    note = note + 1
    if (note > SEGS) {
      note = 0
      base = Math.round(Math.random()*10)
    }

    for (var i = 0; i < SEGSIZE; i++) {
      var n = i + seg * SEGSIZE
      var gain = 4 * i * (SEGSIZE - i) / (SEGSIZE * SEGSIZE)

      // Set raw data for next segment
      samples[n] = Math.sin(n/SAMPLES * tone * Math.PI) * gain

      // clear out the samples for segment after (only because it looks cooler)
      samples[i + nextseg * SEGSIZE] = 0
    }

    // Chrome won't let you reassign buffers, but it will let you change the contents of the buffer
    // https://bugs.chromium.org/p/chromium/issues/detail?id=448960
    // Firefox will let you reassign the buffer, but won't let you change the contents
    // (But not for long: https://bugzilla.mozilla.org/show_bug.cgi?id=1161025)
    // Spec says: https://github.com/WebAudio/web-audio-api/issues/288
    if (samples === copy) {
      buffer = context.createBuffer(1, 48000, 48000)
      buffer.copyToChannel(samples, 0)
      bsn.buffer = buffer
    }

    drawGraph()

    seg = nextseg
  }, TIME / SEGS * 1000)
},  TIME / 2 * 1000)

var drawGraph = function() {
  ctx.clearRect(0, -1, OS_WIDTH, 2)
  for (var i = 0; i < OS_WIDTH; i++) {
    ctx.fillRect(i, 0, 1, samples[Math.round(i/OS_WIDTH*SAMPLES)])
  }
  document.body.style.color = '#' + Math.round(Math.random() * 0xFFFFFF).toString(16)
}

drawGraph()

var drawMarker = function() {
  ctx.fillStyle = 'red'
  var x = context.currentTime % TIME / TIME * OS_WIDTH
  ctx.fillRect(x, -0.01, 10*OVERSAMPLE, 0.02)
  ctx.fillStyle = 'black'
  requestAnimationFrame(drawMarker)
}
requestAnimationFrame(drawMarker)