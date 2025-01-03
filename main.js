"use strict";
import {host, connect} from 'https://luiscastro193.github.io/webrtc-chat/webrtc.js';

const root = document.querySelector(':root');
const createButton = document.getElementById('create-button');
const joinButton = document.getElementById('join-button');
const nameForm = document.getElementById('name-form');
const roomForm = document.getElementById('room-form');
const playersForm = document.getElementById('players-form');
const info = document.getElementById('info');
const playerList = document.getElementById('players');
const main = document.querySelector('main');
const buttonContainer = main.querySelector('.button-container');
const dialog = document.querySelector('dialog');
const dialogMsg = dialog.querySelector('p');
const dialogButton = dialog.querySelector('button');

const initialMaxTime = 1500;
const hostChannels = new Map();
let myChannel;
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
		dialogButton.onclick = () => {
			dialog.close();
			resolve();
		};
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

function setNPlayers() {
	return new Promise(resolve => {
		playersForm.onsubmit = event => {
			event.preventDefault();
			playersForm.hidden = true;
			nPlayers = playersForm.elements['players'].valueAsNumber;
			resolve();
		};
		
		playersForm.hidden = false;
		playersForm.elements['players'].focus();
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
		players = [myName, ...hostChannels.keys(), ...Array(nPlayers - hostChannels.size - 1).fill('')];
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
	return winners[Math.trunc(Math.random() * winners.length)];
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

async function setAsHost() {
	createButton.disabled = true;
	joinButton.disabled = true;
	
	await setNPlayers();
	await setName();
	
	const code = Math.trunc(Math.random() * 10000).toString().padStart(4, '0');
	info.textContent = `Hosting room ${code}`;
	updatePlayers();
	
	while (hostChannels.size < nPlayers - 1) { try {
		let [player, channel] = await host(code);
		
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
	} catch (e) {console.error(e);}}
	
	startGame();
}

async function connectToRoom() {
	createButton.disabled = true;
	joinButton.disabled = true;
	
	const code = await getCode();
	await setName();
	info.textContent = `Connecting to room ${code}...`;
	try {
		myChannel = await connect(code, myName);
	}
	catch (e) {
		info.textContent = `Connection to room ${code} failed`;
		throw e;
	}
	myChannel.addEventListener('message', event => handleHostMessage(event.data));
	info.textContent = `Connected to room ${code}`;
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
