const { transpose } = require('../array2d-utils')

function getDataAsObjects(data) {
	return data.slice(1).map(row => transpose([data[0], row])).map(entries => Object.fromEntries(entries))
}

function calcAccuracy(dataObjects, classifier) {
	const numOfTrue =	dataObjects
		.map(obj => ({
			predicted: classifier.classify(obj).decision,
			actual: obj.decision,
		}))
		.reduce((acc, { predicted, actual }) => acc + (predicted === actual ? 1 : 0), 0)

	return numOfTrue / dataObjects.length
}

const createRandomGenerator = seed => function generateRandom() {
	// https://stackoverflow.com/a/19303725
	const x = Math.sin(seed++) * 100000

	return x - Math.floor(x)
}

function randomShuffle(data, seed) {
	const randomGenerator = createRandomGenerator(seed)
	const shuffledData = [...data]
	shuffledData.sort(() => randomGenerator() - randomGenerator())
	return shuffledData
}

function splitData(data, percentage = 0.2) {
	const len = Math.trunc(data.length * percentage)

	const trainData = [...data]

	const testData = [...trainData.splice(0, len)]

	return [
		trainData,
		testData,
	]
}

module.exports = {
	calcAccuracy, getDataAsObjects, splitData, randomShuffle,
}
