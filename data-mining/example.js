const fs = require('fs')
const path = require('path')

const prepareData = require('./prepareData')

const createId3Classifier = require('./algorithms/id3')
const createBayesClassifier = require('./algorithms/bayes')
const {
	calcAccuracy, getDataAsObjects, randomShuffle, splitData,
} = require('./data-utils')

function readFile(filePath) {
	try {
		let data = fs.readFileSync(filePath, 'utf8')
		data = data.split('\n').map(str => str.split(','))
		return data
	} catch (err) {
		console.error(err)
		return null
	}
}

const dataPath = path.join(__dirname, 'heart_disease_male.csv')

const continuosAttributes = ['age', 'rest_blood_pressure', 'max_heart_rate']

const { data: originalData, attributes } = prepareData({
	data: readFile(dataPath),
	continuosAttributes,
	decisionAttribute: 'disease',
	missingDataValues: ['?', ''],
	positiveDecisionValue: 'positive',
	renameDecisionTo: 'decision',
})

const shuffledData = randomShuffle(originalData, 1)

const [trainData, testData] = splitData(shuffledData, 0.30)
trainData.unshift(attributes.slice())
testData.unshift(attributes.slice())

const id3Classifier = createId3Classifier(trainData, continuosAttributes)
const bayesClassifier = createBayesClassifier(trainData, continuosAttributes)

console.log({
	originalDataLength: originalData.length,
	trainDataLength: trainData.length - 1,
	testDataLength: testData.length - 1,
	bayesTrainAccuracy: calcAccuracy(getDataAsObjects(trainData), bayesClassifier),
	bayesTestAccuracy: calcAccuracy(getDataAsObjects(testData), bayesClassifier),
	id3TrainAccuracy: calcAccuracy(getDataAsObjects(trainData), id3Classifier),
	id3TestAccuracy: calcAccuracy(getDataAsObjects(testData), id3Classifier),
})
console.log('-'.repeat(64))
const objectToBeClassified = {
	age: 43,
	rest_blood_pressure: 140,
	max_heart_rate: 135,
	blood_sugar: 'FALSE',
	rest_electro: 'normal',
	chest_pain_type: 'asympt',
	exercice_angina: 'yes',
}

console.log('object to be classified:', objectToBeClassified, '\n')
console.log('using id3:', id3Classifier.classify(objectToBeClassified), '\n')
console.log('using bayes:', bayesClassifier.classify(objectToBeClassified), '\n')

console.log('(if decision is "1" then positive, otherwise negative)')
