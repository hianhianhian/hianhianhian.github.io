// https://developer.mozilla.org/en-US/docs/Web/API/Element/onfullscreenchange

function toggleFullscreen() {
  let elem = document.getElementById("chat-wrapper");

  elem.onfullscreenchange = handleFullscreenChange;
  if (!document.fullscreenElement) {
    elem.requestFullscreen().then({}).catch(err => {
      alert(`Error attempting to enable full-screen mode: ${err.message} (${err.name})`);
    });
  } else {
    document.exitFullscreen();
  }
}

function handleFullscreenChange(event) {
  let elem = event.target;
  let isFullscreen = document.fullscreenElement === elem;
}
