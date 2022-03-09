const { transpose, partition2dArray } = require('.')

describe('array2d-utils module', () => {
	describe('transpose', () => {
		it('works when array is empty', () => {
			expect(transpose([])).toEqual([])
		})

		it('works when array is vector of length 1', () => {
			expect(transpose([1])).toEqual([[1]])
		})

		it('works when array is vector of length > 1', () => {
			expect(transpose([1, 2])).toEqual([[1], [2]])
			expect(transpose([1, 2, 3])).toEqual([[1], [2], [3]])
		})

		it('works when array is a matrix of dimensions [1][1]', () => {
			expect(transpose([[1]])).toEqual([[1]])
		})

		it('works when array is a matrix of dimensions [1][2+]', () => {
			expect(transpose([[1, 2]])).toEqual([[1], [2]])
			expect(transpose([[1, 2, 3]])).toEqual([[1], [2], [3]])
		})

		it('works when array is a matrix of dimensions [2+][1]', () => {
			expect(transpose([[1], [2]])).toEqual([[1, 2]])
			expect(transpose([[1], [2], [3]])).toEqual([[1, 2, 3]])
		})

		it('works when array is a matrix of dimensions [n][n] ; n >= 2', () => {
			expect(transpose([[1, 2], [3, 4]])).toEqual([[1, 3], [2, 4]])
			expect(transpose([[1, 2, 3], [4, 5, 6], [7, 8, 9]])).toEqual([[1, 4, 7], [2, 5, 8], [3, 6, 9]])
		})

		it('works when array is a matrix of dimensions [n][m] ; n != m, n >= 2, m >= 2', () => {
			expect(transpose([[1, 2], [3, 4], [5, 6]])).toEqual([[1, 3, 5], [2, 4, 6]])
			expect(transpose([[1, 2, 3], [4, 5, 6]])).toEqual([[1, 4], [2, 5], [3, 6]])
		})
	})

	describe('partition2dArray', () => {
		it('works when 2d array dimensions are [1][1]', () => {
			expect(partition2dArray([['a']], 0)).toEqual(new Map([
				['a', [[]]],
			]))
		})

		it('works when 2d array dimensions are [1][2+]', () => {
			expect(partition2dArray([['a', 'b']], 0)).toEqual(new Map([
				['a', [['b']]],
			]))

			expect(partition2dArray([['a', 'b', 'c']], 0)).toEqual(new Map([
				['a', [['b', 'c']]],
			]))

			expect(partition2dArray([['a', 'b', 'c', 'd']], 0)).toEqual(new Map([
				['a', [['b', 'c', 'd']]],
			]))
		})

		it('works when 2d array dimensions are [2+][1]', () => {
			expect(partition2dArray([['a'], ['b']], 0)).toEqual(new Map([
				['a', [[]]],
				['b', [[]]],
			]))

			expect(partition2dArray([['a'], ['b'], ['c'], ['d']], 0)).toEqual(new Map([
				['a', [[]]],
				['b', [[]]],
				['c', [[]]],
				['d', [[]]],
			]))
		})

		it('supports negative indexes', () => {
			expect(partition2dArray([[1, 'a', 11], [2, 'a', 22]], -2)).toEqual(new Map([
				['a', [[1, 11], [2, 22]]],
			]))
		})

		it('works when both 2d array dimensions are >= 2', () => {
			expect(partition2dArray([['a', 1, 11, 111], ['b', 2, 22, 222], ['c', 3, 33, 333]], 0)).toEqual(new Map([
				['a', [[1, 11, 111]]],
				['b', [[2, 22, 222]]],
				['c', [[3, 33, 333]]],
			]))
		})

		it('works: working example', () => {
			const arr = [
				['r1-c1', 'r1-c2', 'a', 'r1-c3', 0],
				['r2-c1', 'r2-c2', 'a', 'r2-c3', 1],
				['r3-c1', 'r3-c2', 'b', 'r3-c3', 2],
				['r4-c1', 'r4-c2', 'b', 'r4-c3', 3],
				['r5-c1', 'r5-c2', 'b', 'r5-c3', 4],
				['r6-c1', 'r6-c2', 'a', 'r6-c3', 5],
				['r7-c1', 'r7-c2', 'c', 'r7-c3', 6],
				['r8-c1', 'r8-c2', 'a', 'r8-c3', 7],
			]
			expect(partition2dArray(arr, -3)).toEqual(new Map([
				['a', [
					['r1-c1', 'r1-c2', 'r1-c3', 0],
					['r2-c1', 'r2-c2', 'r2-c3', 1],
					['r6-c1', 'r6-c2', 'r6-c3', 5],
					['r8-c1', 'r8-c2', 'r8-c3', 7],
				]],
				['b', [
					['r3-c1', 'r3-c2', 'r3-c3', 2],
					['r4-c1', 'r4-c2', 'r4-c3', 3],
					['r5-c1', 'r5-c2', 'r5-c3', 4],
				]],
				['c', [
					['r7-c1', 'r7-c2', 'r7-c3', 6],
				]],
			]))
		})
	})
})
