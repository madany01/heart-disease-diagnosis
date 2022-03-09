import createId3Classifier from '../data-mining/algorithms/id3'
import prepareData from '../data-mining/prepareData'
import createBayesClassifier from '../data-mining/algorithms/bayes'
import dataset from '../data-mining/heart_disease_male.csv'

const continuosAttributes = ['age', 'rest_blood_pressure', 'max_heart_rate']

const { data: trainData, attributes } = prepareData({
	data: dataset,
	continuosAttributes,
	decisionAttribute: 'disease',
	missingDataValues: ['?', ''],
	positiveDecisionValue: 'positive',
	renameDecisionTo: 'decision',
})

trainData.unshift(attributes.slice())

const id3Classifier = createId3Classifier(trainData, continuosAttributes)
const bayesClassifier = createBayesClassifier(trainData, continuosAttributes)

const form = document.querySelector('form')
const resultEl = document.querySelector('.result')
const resultIcon = resultEl.querySelector('.result-icon')

resultIcon.addEventListener('animationend', () => {
	resultIcon.classList.remove('animate')
})

form.addEventListener('input', () => {
	resultEl.classList.remove('show')
	resultIcon.classList.remove('animate')
})

form.addEventListener('submit', e => {
	e.preventDefault()
	const entries = [...new FormData(form)]
		.filter(([, value]) => value !== '')
		.map(([attr, value]) => {
			if (!continuosAttributes.includes(attr)) return [attr, value]
			return [attr, Number(value)]
		})
	const dataObject = Object.fromEntries(entries)
	console.log(dataObject)

	let result

	if (dataObject.algorithm === 'id3') {
		result = id3Classifier.classify(dataObject)
	} else {
		result = bayesClassifier.classify(dataObject)
	}

	console.log(result)
	const { decision } = result
	resultEl.classList.remove('positive', 'negative')
	resultEl.classList.add('show', ['negative', 'positive'][decision])
	resultIcon.classList.add('animate')
})
