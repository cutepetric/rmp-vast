import { FW } from '../fw/fw';
import { FWVAST } from '../fw/fw-vast';
import { PING } from '../tracking/ping';
import { VASTPLAYER } from '../players/vast-player';
import { CONTENTPLAYER } from '../players/content-player';
import { API } from '../api/api';
import { VASTERRORS } from '../utils/vast-errors';

const NONLINEAR = {};

var _onNonLinearLoadError = function () {
  PING.error.call(this, 502);
  VASTERRORS.process.call(this, 502);
};

var _onNonLinearLoadSuccess = function () {
  if (DEBUG) {
    FW.log('RMP-VAST: success loading non-linear creative at ' + this.nonLinearCreativeUrl);
  }
  this.adOnStage = true;
  this.adMediaUrl = this.nonLinearCreativeUrl;
  API.createEvent.call(this, 'adloaded');
  API.createEvent.call(this, 'adimpression');
  API.createEvent.call(this, 'adstarted');
  FWVAST.dispatchPingEvent.call(this, ['impression', 'creativeView', 'start']);
};

var _onNonLinearClickThrough = function () {
  try {
    window.open(this.clickThroughUrl, '_blank');
    if (this.params.pauseOnClick) {
      this.pause();
    }
    API.createEvent.call(this, 'adclick');
    FWVAST.dispatchPingEvent.call(this, 'clickthrough');
  } catch (e) {
    FW.trace(e);
  }
};

NONLINEAR.update = function () {
  if (DEBUG) {
    FW.log('RMP-VAST: appending non-linear creative to .rmp-ad-container element');
  }
  this.nonLinearCreative = document.createElement('img');
  this.nonLinearCreative.className = 'rmp-ad-non-linear-creative';
  this.nonLinearCreative.style.width = this.nonLinearCreativeWidth + 'px';
  this.nonLinearCreative.style.height = this.nonLinearCreativeHeight + 'px';
  this.onNonLinearLoadError = _onNonLinearLoadError.bind(this);
  this.nonLinearCreative.addEventListener('error', this.onNonLinearLoadError);
  this.onNonLinearLoadSuccess = _onNonLinearLoadSuccess.bind(this);
  this.nonLinearCreative.addEventListener('load', this.onNonLinearLoadSuccess);
  if (this.clickThroughUrl) {
    this.onNonLinearClickThrough = _onNonLinearClickThrough.bind(this);
    this.nonLinearCreative.addEventListener('click', this.onNonLinearClickThrough);
  }
  this.nonLinearCreative.src = this.nonLinearCreativeUrl;
  this.adContainer.appendChild(this.nonLinearCreative);
  FW.show(this.adContainer);
  CONTENTPLAYER.play.call(this);
};

NONLINEAR.parse = function (nonLinearAds) {
  if (DEBUG) {
    FW.log('RMP-VAST: start parsing NonLinearAds');
  }
  this.adIsLinear = false;

  let nonLinear = nonLinearAds[0].getElementsByTagName('NonLinear');
  // at least 1 NonLinear is expected to continue
  // but according to spec this should not trigger an error
  // 2.3.4 One or more <NonLinear> ads may be included within a <NonLinearAds> element.
  if (nonLinear.length < 1) {
    return;
  }
  let currentNonLinear;
  let nonLinearCreativeUrl = '';
  // The video player should poll each <NonLinear> element to determine 
  // which creative is offered in a format the video player can support.
  for (let i = 0, len = nonLinear.length; i < len; i++) {
    currentNonLinear = nonLinear[i];
    let width = currentNonLinear.getAttribute('width');
    // width attribute is required
    if (width === null || width === '') {
      PING.error.call(this, 101, this.inlineOrWrapperErrorTags);
      VASTERRORS.process.call(this, 101);
      continue;
    }
    let height = currentNonLinear.getAttribute('height');
    // height attribute is also required
    if (height === null || height === '') {
      PING.error.call(this, 101, this.inlineOrWrapperErrorTags);
      VASTERRORS.process.call(this, 101);
      continue;
    }
    if (parseInt(height) <= 0 || parseInt(width) <= 0) {
      continue;
    }
    let staticResource = currentNonLinear.getElementsByTagName('StaticResource');
    // we expect at least one StaticResource tag
    // we do not support IFrameResource or HTMLResource
    if (staticResource.length < 1) {
      continue;
    }
    let creativeType;
    for (let i = 0, len = staticResource.length; i < len; i++) {
      let currentStaticResource = staticResource[i];
      creativeType = currentStaticResource.getAttribute('creativeType');
      if (creativeType === null || creativeType === '') {
        continue;
      }
      // we only support images for StaticResource
      let imagePattern = /^image\/(png|jpeg|jpg|gif)$/i;
      if (!imagePattern.test(creativeType)) {
        continue;
      }
      let containerWidth = FW.getWidth(this.container);
      // if width of non-linear creative does not fit within current player container width 
      // we should skip this creative
      if (parseInt(width) > containerWidth) {
        continue;
      }
      nonLinearCreativeUrl = FWVAST.getNodeValue(currentStaticResource, true);
      break;
    }
    // we have a valid NonLinear/StaticResource with supported creativeType - we break
    if (nonLinearCreativeUrl !== '') {
      this.nonLinearCreativeUrl = nonLinearCreativeUrl;
      this.nonLinearCreativeHeight = height;
      this.nonLinearCreativeWidth = width;
      this.nonLinearContentType = creativeType;
      break;
    }
  }
  // if not supported NonLinear type ping for error
  if (!this.nonLinearCreativeUrl || !currentNonLinear) {
    PING.error.call(this, 503, this.inlineOrWrapperErrorTags);
    VASTERRORS.process.call(this, 503);
    return;
  }
  if (DEBUG) {
    FW.log('RMP-VAST: valid non-linear creative data at ' + this.nonLinearCreativeUrl);
  }
  let nonLinearClickThrough = currentNonLinear.getElementsByTagName('NonLinearClickThrough');
  // if NonLinearClickThrough is present we only expect one tag
  if (nonLinearClickThrough.length === 1) {
    this.clickThroughUrl = FWVAST.getNodeValue(nonLinearClickThrough[0], true);
    let nonLinearClickTracking = nonLinear[0].getElementsByTagName('NonLinearClickTracking');
    if (nonLinearClickTracking.length > 0) {
      for (let i = 0, len = nonLinearClickTracking.length; i < len; i++) {
        let nonLinearClickTrackingUrl = FWVAST.getNodeValue(nonLinearClickTracking[i], true);
        if (nonLinearClickTrackingUrl !== null) {
          this.trackingTags.push({ event: 'clickthrough', url: nonLinearClickTrackingUrl });
        }
      }
    }
  }
  VASTPLAYER.append.call(this);

};

export { NONLINEAR };