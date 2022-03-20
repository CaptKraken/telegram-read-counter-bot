const numberMapKhmerToArabic = {
  "០": 0,
  "១": 1,
  "២": 2,
  "៣": 3,
  "៤": 4,
  "៥": 5,
  "៦": 6,
  "៧": 7,
  "៨": 8,
  "៩": 9,
};
const numberMapArabicToKhmer = {
  0: "០",
  1: "១",
  2: "២",
  3: "៣",
  4: "៤",
  5: "៥",
  6: "៦",
  7: "៧",
  8: "៨",
  9: "៩",
};

/**
 * converts khmer numerals to arabic
 * @param {string} value - i.e. "១២"​, "12", "១២52"
 * @returns string; formatted arabic numerals or the original value
 */
const convertKhmerToArabicNumerals = (value) => {
  let splited = value.split("");
  for (let i = 0; i < splited.length; i++) {
    if (
      numberMapKhmerToArabic[splited[i]] ||
      numberMapKhmerToArabic[splited[i]] === 0
    ) {
      // replace it with the arabic numeral
      splited[i] = numberMapKhmerToArabic[splited[i]];
    } else if (numberMapArabicToKhmer[splited[i]]) {
      // skip
      continue;
    } else {
      // if the value wasn't found in the number maps, returns value
      return value;
    }
  }
  return splited.join("");
};

/**
 * checks if string is a number
 * @param {string} value - i.e. "១២"​, "12", "១២52", "១z២52"
 * @returns boolean
 */
const isNumber = (value) =>
  Number(convertKhmerToArabicNumerals(value)).toString() !== "NaN";

/**
 * checks if string has "នាទី" in it
 * @param {string} value - i.e. "១២នាទី"​, "12នាទី"
 * @returns boolean
 */
const isDurationString = (value) => value.includes("នាទី");

/**
 * checks if string has "ដង" in it
 * @param {string} value - i.e. "១២នាទី"​, "12នាទី"
 * @returns boolean
 */
const isTimesString = (value) => value.includes("ដង");

module.exports = {
  convertKhmerToArabicNumerals: convertKhmerToArabicNumerals,
  isNumber: isNumber,
  isDurationString: isDurationString,
  isTimesString: isTimesString,
};
