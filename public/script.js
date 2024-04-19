const cardsContainer = document.querySelector('.cards-container');
const addNewCardsButton = document.querySelector('.new-cards');
const prevCard = document.getElementById('prev-card');
const nextCard = document.getElementById('next-card');
const currentCardNumber = document.querySelector('.cards-nav__count');
const addNewForm = document.querySelector('.add-container');
const addNewFormCloseButton = document.querySelector('.add-container__close');
const questionFormElement = document.getElementById('question');
const answerFormElement = document.getElementById('answer');
const addNewCardButton = document.querySelector('.add-container__button');
const clearCardsButton = document.querySelector('.clear-cards');
const addImageInput = document.getElementById('card-image');
const addImageForm = document.querySelector('.add-image');
const addImageTextArea = document.querySelector('.add-image-area');

const cardsList = [];
const cardBgColorsNumber = 4;

let currentActiveCard = 0;
let imageData = null;
let randomBgColor = getRandomNumber(1, 4);

const allowedExtension = ['image/jpeg', 'image/jpg', 'image/png'];

const cardsData = getCardsData();

function createCards() {
	if (cardsData.length === 0) {
		cardsContainer.innerHTML = '<p style="font-size: 18px">There are no cards yet, to create click on the create button...</p>';
	} else {
		cardsContainer.innerHTML = '';
		cardsData.forEach((card, index) => createCard(card, index));
	}
};

createCards();

function getRandomNumber(min, max) {
	return Math.floor(Math.random() * (max - min) + min);
};

function createCard(data, index) {

	const {question, answer, color, image} = data;

	const card = document.createElement('div');
	card.classList.add('card');

	if (index === 0) {
		card.classList.add('active');
	}

	const imageContent = image ? `
		<div class="image-wrapper" style="border: 10px solid var(--card-color-${color})">
			<img class="card-image" src="${image}" alt="${question}"></img>
		</div>` : '';

	card.innerHTML = `
		<div class="inner-card" style="background-color: var(--card-color-${color})">
			<div class="inner-card__front">
				${imageContent}
				<div class="inner-card__wrapper">
					<p>${question}</p>
				</div>
			</div>
			<div class="inner-card__back" style="background-color:var(--card-color-${color})">
				<p>${answer}</p>
			</div>
		</div>
	`;

	card.addEventListener('click', () => card.classList.toggle('show-answer'));

	cardsList.push(card);
	cardsContainer.appendChild(card);
	updateCardsCounter();
};

function updateCardsCounter() {
	currentCardNumber.innerText = `${currentActiveCard + 1}/${cardsList.length}`;
};

function getCardsData() {
	const cards = JSON.parse(localStorage.getItem('cards'));
	return cards === null ? [] : cards;
};

function setCardsData(cards) {
	localStorage.setItem('cards', JSON.stringify(cards));
	window.location.reload();
};

nextCard.addEventListener('click', () => {
	cardsList[currentActiveCard].className = 'card left';
	currentActiveCard++;

	if (currentActiveCard > cardsList.length - 1) {
		currentActiveCard = cardsList.length - 1;
	}

	cardsList[currentActiveCard].className = 'card active';
	updateCardsCounter();
});

prevCard.addEventListener('click', () => {
	cardsList[currentActiveCard].className = 'card';

	currentActiveCard--;
	
	if (currentActiveCard < 0) {
		currentActiveCard = 0;
	} 

	cardsList[currentActiveCard].className = 'card active';
	updateCardsCounter();
});

addNewCardsButton.addEventListener('click', () => {
	addNewForm.classList.remove('hidden');
});

addNewFormCloseButton.addEventListener('click', () => {
	addNewForm.classList.add('hidden');
});


addNewCardButton.addEventListener('click', () => {
	const question = questionFormElement.value;
	const answer = answerFormElement.value;

	if (question.trim() && answer.trim()) {
		const newCard = {
			question,
			answer,
			color: randomBgColor,
			image: imageData,
		};
		
		createCard(newCard);
		
		questionFormElement.value = '';
		answerFormElement.value = '';
		
		addNewForm.classList.add('hidden');	

		cardsData.push(newCard);
		setCardsData(cardsData);
	}
});

addImageInput.addEventListener('change', function () {
	let type = this.files[0].type;
	if (allowedExtension.indexOf(type) > -1) {
		addImageForm.classList.remove('error-image-type');
		addImageForm.classList.add('correct-image-type');
		addImageTextArea.innerText = 'Image attached!';

		const reader = new FileReader();

		reader.addEventListener('load', () => {
			imageData = reader.result;
		});

		reader.readAsDataURL(this.files[0]);
	} else {
		addImageForm.classList.add('error-image-type');
		addImageForm.classList.remove('correct-image-type');
		addImageTextArea.innerText = 'Invalid image format!';
	}
});

clearCardsButton.addEventListener('click', () => {
	localStorage.clear();
	window.location.reload();
});