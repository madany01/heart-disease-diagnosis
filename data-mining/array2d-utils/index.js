function partition2dArray(array2d, columnIdx) {
	const numColumns = array2d[0].length
	columnIdx = ((columnIdx % numColumns) + numColumns) % numColumns

	return array2d.reduce((parts, row) => {
		const targetColumnValue = row[columnIdx]

		if (!parts.has(targetColumnValue)) parts.set(targetColumnValue, [])

		parts.get(targetColumnValue).push([...row.slice(0, columnIdx), ...row.slice(columnIdx + 1)])

		return parts
	}, new Map())
}

function transpose(array) {
	const rows = array.length

	if (rows === 0) return []

	const cols = array[0].length

	if (cols === undefined) return transpose([array])

	const ret = new Array(cols).fill(null).map(() => new Array(rows).fill(null))

	for (let i = 0; i < rows; i++) {
		for (let j = 0; j < cols; j++) {
			ret[j][i] = array[i][j]
		}
	}

	return ret
}

module.exports = {
	partition2dArray,
	transpose,
}
