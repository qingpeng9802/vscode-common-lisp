import type * as vscode from 'vscode';

function excludeRangesFromRanges(oriRanges: [number, number][], excludeRanges: [number, number][]): [number, number][] {
  const res: [number, number][] = [];
  for (const currRange of oriRanges) {
    const [start, end] = currRange;

    const idxStart = bisectRight(excludeRanges, start, item => item[0]);
    const idxEnd = bisectRight(excludeRanges, end, item => item[1]);

    if (idxStart === idxEnd) {
      res.push([start, end]);
      continue;
    }

    let newStart = start;
    for (let i = idxStart; i < idxEnd; ++i) {
      const [exStart, exEnd] = excludeRanges[i];
      res.push([newStart, exStart]);
      newStart = exEnd;
    }
    res.push([newStart, end]);
  }

  return res;
}


function mergeSortedIntervals(intervals: [number, number][]): [number, number][] {
  const merged: [number, number][] = [];
  for (const interval of intervals) {
    const [intervalStart, intervalEnd] = interval;
    const mergedLast = merged.at(-1)!;
    if (merged.length === 0 || mergedLast[1] < intervalStart) {
      merged.push(interval);
    } else {
      mergedLast[1] = Math.max(mergedLast[1], intervalEnd);
    }
  }
  return merged;
}

function mergeSortedMXArrList(sortedMXArrLis: [number, number][][]) {
  const res = sortedMXArrLis.reduce(
    (previousValue, currentValue) => mergeSortedMXArr(previousValue, currentValue),
    []
  );
  return res;
}

// MX: mutually exclusive
function mergeSortedMXArr(arr1: [number, number][], arr2: [number, number][]): [number, number][] {
  if (arr1.length === 0) {
    return arr2;
  } else if (arr2.length === 0) {
    return arr1;
  }

  const m = arr1.length;
  const n = arr2.length;
  const total = m + n;
  // use packed arr instead of holey arr https://v8.dev/blog/elements-kinds
  const res: [number, number][] = [];

  for (let i = 0, p1 = 0, p2 = 0; i < total; ++i) {
    // run out arr2 || arr1 is smaller
    if (p2 >= n || (p1 < m && arr1[p1][0] < arr2[p2][0])) {
      res.push(arr1[p1]);
      ++p1;
    } else {
      res.push(arr2[p2]);
      ++p2;
    }
  }

  return res;
}

function bisectRight(arr: any[], x: number | vscode.Position, key?: (item: any) => number | vscode.Position): number {
  let mid = -1;
  let lo = 0;
  let hi = arr.length;

  if (key !== undefined) {
    if (typeof x === 'number') {
      while (lo < hi) {
        mid = Math.floor((lo + hi) / 2);
        if (x < (key(arr[mid]) as number)) {
          hi = mid;
        } else {
          lo = mid + 1;
        }
      }
    } else {
      while (lo < hi) {
        mid = Math.floor((lo + hi) / 2);
        if (x.isBefore(key(arr[mid]) as vscode.Position)) {
          hi = mid;
        } else {
          lo = mid + 1;
        }
      }
    }

  } else {
    while (lo < hi) {
      mid = Math.floor((lo + hi) / 2);
      if (x < arr[mid]) {
        hi = mid;
      } else {
        lo = mid + 1;
      }
    }
  }
  return lo;
}

function bisectLeft(arr: any[], x: number | vscode.Position, key?: (item: any) => number | vscode.Position): number {
  let mid = -1;
  let lo = 0;
  let hi = arr.length;

  if (key !== undefined) {
    if (typeof x === 'number') {
      while (lo < hi) {
        mid = Math.floor((lo + hi) / 2);
        if (x <= (key(arr[mid]) as number)) {
          hi = mid;
        } else {
          lo = mid + 1;
        }
      }
    } else {
      while (lo < hi) {
        mid = Math.floor((lo + hi) / 2);
        if (x.isBeforeOrEqual(key(arr[mid]) as vscode.Position)) {
          hi = mid;
        } else {
          lo = mid + 1;
        }
      }
    }

  } else {
    while (lo < hi) {
      mid = Math.floor((lo + hi) / 2);
      if (x <= arr[mid]) {
        hi = mid;
      } else {
        lo = mid + 1;
      }
    }
  }
  return lo;
}

// leave for example only
function sortRangeInPlaceEntry(d: [any, [number, number]][]) {
  d.sort(
    (a, b) => {
      return a[1][0] - b[1][0];
    });
}
function sortRangeInPlace(arr: vscode.Range[]) {
  arr.sort(
    (a, b) => {
      return a.start.isBeforeOrEqual(b.start) ? -1 : 1;
    });
}


export {
  excludeRangesFromRanges,
  mergeSortedIntervals,
  mergeSortedMXArrList,
  mergeSortedMXArr,
  bisectRight,
  bisectLeft
};
