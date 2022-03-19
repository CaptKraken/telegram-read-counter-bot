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

const convertKhmerToArabicNumerals = (value) => {
  let splited = value.split("");
  let result = [];
  for (let i = 0; i < splited.length; i++) {
    if (
      numberMapKhmerToArabic[splited[i]] ||
      numberMapKhmerToArabic[splited[i]] === 0
    ) {
      result[i] = numberMapKhmerToArabic[splited[i]];
    } else if (numberMapArabicToKhmer[splited[i]]) {
      result[i] = splited[i];
    } else {
      // if the value wasn't found in the number map, returns value
      return value;
    }
  }
  return result.join("");
};

const isNumber = (value) =>
  Number(convertKhmerToArabicNumerals(value)).toString() !== "NaN";
const isDurationString = (value) => value.includes("នាទី");
const isTimesString = (value) => value.includes("ដង");

module.exports = {
  convertKhmerToArabicNumerals: convertKhmerToArabicNumerals,
  isNumber: isNumber,
  isDurationString: isDurationString,
  isTimesString: isTimesString,
};
