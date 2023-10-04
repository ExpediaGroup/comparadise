---
sidebar_position: 1
---

# Updating Base Images

If your visual tests fail, it could be due to one of three things:

### You have written a brand new visual test, and the base image does not yet exist.

In this case, the `Visual Regression` status should have instructed you to create a new base image via the Comparadise UI.
Simply click on the link provided in the Comparadise comment or commit status to navigate to Comparadise and update base
images to create the base image for your new test.

### Your visual tests failed to take a screenshot.

In this case, we cannot allow base image update because there may be an underlying issue with a component. This will require
you to debug the test and figure out what went wrong that prevented the screenshots from being taken. Typically this is
caused by a component not rendering properly or your test failing to match a selector.

### Your component or page looks different.

This is the case where there was a visual difference detected on your PR. This should be reviewed in the Comparadise UI,
and if the change is acceptable, base images should be updated.
