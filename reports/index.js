const fs = require('fs')
const path = require('path')

const prepareData = require('../data-mining/prepareData')
const {
	calcAccuracy, getDataAsObjects, randomShuffle, splitData,
} = require('../data-mining/data-utils')

const createId3Classifier = require('../data-mining/algorithms/id3')
const createBayesClassifier = require('../data-mining/algorithms/bayes')

const { getTreeRepresentationForCloudSmart, getEdgesAndNodeInfos } = require('./id3-reporter')

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

function writeFile(filePath, data) {
	try {
		fs.writeFileSync(filePath, data)
		return true
	} catch (error) {
		console.error(error)
		return false
	}
}

function savePreparedData(filePath, data) {
	const str = data
		.map((row, idx) => {
			let res = [...row]

			if (idx !== 0) {
				res = res.map(value => (value === null ? '?' : value))
				const decision = res.at(-1)
				res[res.length - 1] = ['negative', 'positive'][decision]
			} else {
				res[res.length - 1] = 'disease'
			}

			return res.join(',')
		})
		.join('\n')

	writeFile(filePath, str)
}

const originalDataPath = path.join(__dirname, 'OriginalData-heart_disease_male.csv')
const continuosAttributes = ['age', 'rest_blood_pressure', 'max_heart_rate']

const { data: originalData, attributes } = prepareData({
	data: readFile(originalDataPath),
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

savePreparedData(path.join(__dirname, 'data', 'TrainData-heart-disease_male.csv'), trainData)
savePreparedData(path.join(__dirname, 'data', 'TestData-heart-disease_male.csv'), testData)

const id3Classifier = createId3Classifier(trainData, continuosAttributes)
const bayesClassifier = createBayesClassifier(trainData, continuosAttributes)

writeFile(path.join(__dirname, './results/accuracy.json'), JSON.stringify({
	originalDataLength: originalData.length,
	trainDataLength: trainData.length - 1,
	testDataLength: testData.length - 1,
	bayesTrainAccuracy: calcAccuracy(getDataAsObjects(trainData), bayesClassifier),
	bayesTestAccuracy: calcAccuracy(getDataAsObjects(testData), bayesClassifier),
	id3TrainAccuracy: calcAccuracy(getDataAsObjects(trainData), id3Classifier),
	id3TestAccuracy: calcAccuracy(getDataAsObjects(testData), id3Classifier),
}, null, '\t'))

writeFile(
	path.join(__dirname, './results/treeEdges4CloudSmart.csv'),
	getTreeRepresentationForCloudSmart(id3Classifier.getRootNode()).map(line => line.join(',')).join('\n'),
)

writeFile(
	path.join(__dirname, './results/treeStructure.json'),
	JSON.stringify(getEdgesAndNodeInfos(id3Classifier.getRootNode()), (_, v) => {
		if (v instanceof Map) return Object.fromEntries(v)
		return v
	}, '\t'),
)
