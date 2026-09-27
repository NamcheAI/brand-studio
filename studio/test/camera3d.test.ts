import assert from 'node:assert/strict';
import test from 'node:test';
import {
  PREVIEW_MIN_DISTANCE,
  fitPreviewCameraDistance,
  fitSphereDistance,
} from '../src/lib/camera3d';

test('camera fit keeps a sphere inside the limiting viewport angle', () => {
  const radius = 1.2;
  const distance = fitSphereDistance(radius, 34, 1, 1.1);
  const projectedHalfAngle = Math.asin((radius * 1.1) / distance);
  assert.ok(projectedHalfAngle <= (34 * Math.PI) / 360 + Number.EPSILON);
});

test('portrait viewports move the camera farther away', () => {
  const square = fitSphereDistance(1.2, 34, 1);
  const portrait = fitSphereDistance(1.2, 34, 0.6);
  assert.ok(portrait > square);
});

test('preview zoom cannot move inside the clipping-safe floor', () => {
  assert.equal(fitPreviewCameraDistance(0.1, 34, 1), PREVIEW_MIN_DISTANCE);
  assert.ok(fitPreviewCameraDistance(1.2, 34, 0.5) > PREVIEW_MIN_DISTANCE);
});
