(() => {
  if (window.__refocusHideVideos) return;
  window.__refocusHideVideos = true;

  let enabled = true;

  window.addEventListener("message", (event) => {
    if (event.source !== window) return;
    const data = event.data;
    if (data && data.source === "refocus" && data.type === "hide-videos") {
      enabled = !!data.enabled;
    }
  });

  function findVideoEl() {
    const videos = document.querySelectorAll("video");
    return videos.length ? videos[0] : null;
  }

  function isNotMusicUrl(url) {
    return (
      url.indexOf("www.youtube.com") !== -1 ||
      url.indexOf("music.youtube.com") !== -1 ||
      url.indexOf("m.youtube.com") !== -1 ||
      url.indexOf("www.youtube-nocookie.com") !== -1
    );
  }

  function setPlaybackRateAgain(video) {
    try {
      const player = video.parentNode.parentNode;
      const rate = player.getPlaybackRate();
      player.setPlaybackRate(1);
      player.setPlaybackRate(rate);
    } catch (err) {}
  }

  function ensurePlaying(el) {
    try {
      el.parentNode.parentNode.playVideo();
    } catch (e) {
      el.play().catch(() => {});
    }
  }

  function reloadVideo() {
    const el = findVideoEl();
    const tryPlay = () => {
      const v = findVideoEl();
      if (v && (!v.hasAttribute("src") || v.src === "")) ensurePlaying(v);
    };
    if (!el) {
      setTimeout(tryPlay, 1000);
      return;
    }
    if (el.offsetTop < 0) setTimeout(tryPlay, 1000);
  }

  function setNewURL(video, url) {
    const urlParts = url.split("?");
    if (urlParts.length < 2) return;
    const parametersToBeRemoved = ["rn", "rbuf", "range", "ump"];
    let parameters = urlParts[1].split(/[&;]/g);
    parametersToBeRemoved.forEach((k) => {
      parameters = parameters.filter(
        (p) => !p.startsWith(encodeURIComponent(k) + "=")
      );
    });
    url = urlParts[0] + "?" + parameters.join("&");
    if (!enabled || video.src === url) return;

    video.dataset.musicurl = url;
    video.dataset.originalurl = video.src;
    if (!video.paused) video.pause();
    const curTime = video.currentTime;

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.target.nodeName === "VIDEO") {
          if (
            !mutation.target.hasAttribute("src") ||
            mutation.target.src === ""
          ) {
            reloadVideo();
          }
        }
      }
    });
    observer.observe(video, {
      attributes: true,
      attributeFilter: ["src"],
      attributeOldValue: true
    });
    video.addEventListener("stalled", (e) => {
      reloadVideo(e.target.currentTime);
    });

    video.src = url;
    video.load();
    video.currentTime = curTime;
    ensurePlaying(video);
  }

  function musicModeForYouTube(url, isLive, firstCall) {
    if (isLive !== -1) return;
    const video = findVideoEl();
    if (!video) return;
    setPlaybackRateAgain(video);
    if (isNotMusicUrl(video.src)) {
      if (!firstCall) {
        try {
          const params = new URLSearchParams(url);
          if (
            video.parentNode.parentNode.getVideoData().cpn ===
            params.get("cpn")
          ) {
            setNewURL(video, url);
          }
        } catch (error) {}
      } else {
        setNewURL(video, url);
      }
    } else if (firstCall) {
      setTimeout(() => musicModeForYouTube(url, isLive, false), 5000);
    }
  }

  const origOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (method, url) {
    if (
      enabled &&
      typeof url === "string" &&
      url.indexOf("mime=audio") !== -1
    ) {
      musicModeForYouTube(url, url.indexOf("live=1"), true);
    }
    return origOpen.apply(this, arguments);
  };

  const origFetch = window.fetch;
  window.fetch = async (...args) => {
    if (enabled) {
      const req = args[0];
      const url =
        (typeof req === "string" ? req : (req && (req.url || req.href))) || "";
      if (url.indexOf("mime=audio") !== -1) {
        musicModeForYouTube(url, url.indexOf("live=1"), true);
      } else if (
        url.indexOf("mime=video") !== -1 &&
        url.indexOf("live=1") === -1
      ) {
        return new Response("", { status: 204 });
      }
    }
    return await origFetch(...args);
  };
})();
