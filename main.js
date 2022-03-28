"use strict";
const root = document.querySelector(':root');
const buttonContainer = document.querySelector('.full-size');
let enabled = false;

document.addEventListener('click', function() {
	if (!enabled) {
		root.style.setProperty('--angle', `${Math.random()}turn`);
		buttonContainer.classList.remove("hidden");
		enabled = true;
	}
}, true);

document.querySelector('.button').addEventListener('click', function() {
	buttonContainer.classList.add("hidden");
	enabled = false;
});
