"use strict";
const root = document.querySelector(':root');
const buttonContainer = document.querySelector('.full-size');
let enabled = false;
let initTime;

document.addEventListener('click', function() {
	if (!enabled) {
		root.style.setProperty('--angle', `${Math.random()}turn`);
		buttonContainer.classList.remove("hidden");
		enabled = true;
		initTime = Date.now();
	}
}, true);

document.querySelector('.button').addEventListener('click', function() {
	alert(`${Date.now() - initTime}ms`);
	buttonContainer.classList.add("hidden");
	enabled = false;
});
