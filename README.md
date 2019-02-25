# [WebAudio-Patcher](https://fr0stbyter.github.io/)  [![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](https://www.gnu.org/licenses/gpl-3.0)


A web environment allows you to play with JavaScript and WebAudio.

It's a playground, Every function, variable, method or object are boxes patching with each other. Messages are passing from right to left. (as MaxMSP)

## Examples

Listen MouseMove event, than transform the value to the frequency used to generate a sine wave. Then you can visalize your spectrum.

![Example1](./patchers/example1.jpg)

Or Fetch a Tensorflow model.

![Example2](./patchers/example2.jpg)

Or try [Performance RNN](https://magenta.tensorflow.org/performance-rnn) with TensorFlow.js and [Faust](https://faust.grame.fr)

https://fr0stbyter.github.io/webaudio-patcher/#prnn.json

## Usage

Press N or double click to create a new box.

Press M to create a message.

Ctrl + Click to Lock / Unlock patcher.