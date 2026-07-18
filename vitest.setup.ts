if (typeof HTMLMediaElement !== 'undefined') {
  HTMLMediaElement.prototype.play = function play() {
    return Promise.resolve()
  }
  HTMLMediaElement.prototype.pause = function pause() {}
  HTMLMediaElement.prototype.load = function load() {}
}
