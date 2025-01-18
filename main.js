"use strict";
import {Host, connect} from 'https://luiscastro193.github.io/webrtc-chat/webrtc.js';

const root = document.querySelector(':root');
const createButton = document.getElementById('create-button');
const joinButton = document.getElementById('join-button');
const nameForm = document.getElementById('name-form');
const roomForm = document.getElementById('room-form');
const info = document.getElementById('info');
const shareButton = document.getElementById('share-button');
const qrButton = document.getElementById('qr-button');
const cancelButton = document.getElementById('cancel-button');
const restartButton = document.getElementById('restart-button');
const playerList = document.getElementById('players');
const startButton = document.getElementById('start-button');
const main = document.querySelector('main');
const buttonContainer = main.querySelector('.button-container');
const dialog = document.querySelector('dialog');
const dialogMsg = dialog.querySelector('p');

const initialMaxTime = 1500;
const hostChannels = new Map();
let myChannel;
let code;
let myName;
let nPlayers;
let gameInitiated = false;
let gameEnded = false;
let pushed = false;
let initTime;
let maxTime = initialMaxTime;
let pushTimes;

let modalPromise = Promise.resolve();

async function showModal(message) {
	return modalPromise = modalPromise.then(() => new Promise(resolve => {
		dialogMsg.textContent = message;
		dialog.addEventListener('close', resolve, {once: true});
		dialog.showModal();
	}));
}

function setName() {
	return new Promise(resolve => {
		nameForm.onsubmit = event => {
			event.preventDefault();
			nameForm.hidden = true;
			myName = nameForm.elements['name'].value;
			resolve();
		};
		
		nameForm.hidden = false;
		nameForm.elements['name'].focus();
	});
}

function getCode() {
	return new Promise(resolve => {
		roomForm.onsubmit = event => {
			event.preventDefault();
			roomForm.hidden = true;
			resolve(roomForm.elements['code'].value);
		};
		
		roomForm.hidden = false;
		roomForm.elements['code'].focus();
	});
}

function sendMessage(data) {
	data = JSON.stringify(data);
	
	if (myChannel)
		myChannel.send(data);
	else {
		for (let channel of hostChannels.values())
			channel.send(data);
	}
}

function toItem(string) {
	let li = document.createElement("li");
	li.textContent = string;
	return li;
}

function updatePlayers(players) {
	if (!myChannel) {
		players = [myName, ...hostChannels.keys()];
		sendMessage({type: "players", players});
	}
	
	playerList.innerHTML = '';
	playerList.append(...players.map(toItem));
}

async function startGame() {
	gameInitiated = true;
	
	if (!myChannel)
		sendMessage({type: "startGame"});
	
	await showModal("Game ready");
	if (!gameEnded) main.hidden = false;
}

function finishGame() {
	gameEnded = true;
	main.hidden = true;
	info.textContent = "Game ended";
	restartButton.hidden = false;
	playerList.innerHTML = '';
	
	if (!myChannel) {
		for (let channel of hostChannels.values())
			channel.close();
	}
}

function initButton(from) {
	if (!initTime) {
		if (from != "host")
			sendMessage({type: "initButton"});
		
		initTime = performance.now();
		
		if (!myChannel)
			pushTimes = new Map();
	}
	
	if (from == "self" && maxTime == initialMaxTime)
		maxTime -= 100;
}

function setPush(time) {
	if (!pushed) {
		pushed = true;
		
		if (pushTimes)
			registerPush(myName, time);
		else
			sendMessage({type: "pushButton", time});
	}
}

function calculateWinner() {
	let minTime = Math.min(...pushTimes.values());
	let winners = [...pushTimes.keys()].filter(player => pushTimes.get(player) == minTime);
	
	if (winners.length > 1)
		return winners[Math.trunc(Math.random() * winners.length)];
	else
		return winners[0];
}

function setWinner(player) {
	if (!myChannel) {
		player = calculateWinner();
		sendMessage({type: "winner", player});
	}
	
	showModal(`${player} has pushed the button`);
	buttonContainer.hidden = true;
	pushed = false;
	initTime = null;
	maxTime = initialMaxTime;
	pushTimes = null;
}

function registerPush(player, time) {
	if (pushTimes) {
		pushTimes.set(player, time);
		
		if (pushTimes.size == nPlayers)
			return setWinner();
		
		if (time < maxTime - 200) {
			maxTime = time;
			sendMessage({type: "maxTime", time});
		}
	}
}

setInterval(function() {
	if (initTime && !pushed && performance.now() - initTime > maxTime)
		setPush(maxTime + 100);
}, 50);

function handleMessage(player, data) {
	data = JSON.parse(data);
	
	if (data.type == "initButton")
		initButton("player");
	else if (data.type == "pushButton")
		registerPush(player, data.time);
}

function handleHostMessage(data) {
	data = JSON.parse(data);
	
	if (data.type == "initButton")
		initButton("host");
	else if (data.type == "maxTime")
		maxTime = data.time;
	else if (data.type == "winner")
		setWinner(data.player);
	else if (data.type == "players")
		updatePlayers(data.players);
	else if (data.type == "startGame")
		startGame();
}

async function registerPlayers(host) {
	while (host.listening) {
		let [player, channel] = await host.nextChannel();
		
		if (player == myName)
			player += " 2";
		
		let oldChannel = hostChannels.get(player);
		
		if (oldChannel) {
			oldChannel.close();
			await new Promise(resolve => setTimeout(resolve));
		}
			
		hostChannels.set(player, channel);
		channel.addEventListener('message', event => handleMessage(player, event.data));
		
		channel.addEventListener('close', () => {
			hostChannels.delete(player);
			if (gameInitiated)
				finishGame();
			else
				updatePlayers();
		});
		
		updatePlayers();
	}
}

function connectURL() {
	return new URL('#' + code, location.href);
}

shareButton.onclick = () => {
	let url = connectURL();
	
	if (navigator.share)
		navigator.share({url});
	else
		navigator.clipboard.writeText(url).then(() => showModal("Link copied to clipboard"));
};

qrButton.onclick = () => {
	let url = "https://luiscastro193.github.io/qr-generator/#" + encodeURIComponent(connectURL());
	window.open(url);
}

cancelButton.onclick = () => location.reload();
restartButton.onclick = () => location.reload();

async function setAsHost() {
	createButton.disabled = true;
	joinButton.disabled = true;
	await setName();
	code = Math.trunc(Math.random() * 10000).toString().padStart(4, '0');
	info.textContent = `Hosting room ${code}`;
	shareButton.hidden = false;
	qrButton.hidden = false;
	updatePlayers();
	const host = new Host(code);
	
	startButton.onclick = () => {
		startButton.hidden = true;
		shareButton.hidden = true;
		qrButton.hidden = true;
		host.stopListening();
		nPlayers = hostChannels.size + 1;
		startGame();
	};
	
	startButton.hidden = false;
	registerPlayers(host);
}

async function connectToRoom() {
	createButton.disabled = true;
	joinButton.disabled = true;
	
	if (!code) code = await getCode();
	await setName();
	info.textContent = `Connecting to room ${code}...`;
	cancelButton.hidden = false;
	
	try {
		myChannel = await connect(code, myName);
	}
	catch (e) {
		info.textContent = `Connection to room ${code} failed`;
		throw e;
	}
	myChannel.addEventListener('message', event => handleHostMessage(event.data));
	info.textContent = `Connected to room ${code}`;
	cancelButton.hidden = true;
	myChannel.addEventListener('close', finishGame);
}

const pushEvent = 'ontouchstart' in main ? 'touchstart' : 'click';

main.addEventListener(pushEvent, function() {
	if (buttonContainer.hidden) {
		root.style.setProperty('--angle', `${Math.random()}turn`);
		buttonContainer.hidden = false;
		initButton("self");
	}
}, true);

main.querySelector('.button').addEventListener(pushEvent, function() {
	setPush(performance.now() - initTime);
	buttonContainer.hidden = true;
});

createButton.onclick = setAsHost;
joinButton.onclick = connectToRoom;
createButton.disabled = false;
joinButton.disabled = false;

if (location.hash) {
	code = location.hash.slice(1);
	history.replaceState(null, '', ' ');
	connectToRoom();
}

window.onhashchange = () => location.reload();
