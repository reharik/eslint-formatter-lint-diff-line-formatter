/**
 * @fileoverview lint-diff-line custom reporter
 * @author Raif Harik
 */
'use strict';
const chalk = require('chalk');
const stripAnsi = require('strip-ansi');
const table = require('text-table');

//------------------------------------------------------------------------------
// Helpers
//------------------------------------------------------------------------------

/**
 * Given a word and a count, append an s if count is not one.
 * @param {string} word A word in its singular form.
 * @param {int} count A number controlling whether word should be pluralized.
 * @returns {string} The original word with an s on the end if count is not one.
 */
function pluralize(word, count) {
  return count === 1 ? word : `${word}s`;
}

const buildResult = results => {
  if (!results) {
    return {};
  }

  let output = '',
    errorCount = 0,
    warningCount = 0,
    fixableErrorCount = 0,
    fixableWarningCount = 0,
    summaryColor = 'yellow';

  results.forEach(result => {
    const messages = result.messages;

    if (messages.length === 0) {
      return;
    }

    errorCount += result.errorCount;
    warningCount += result.warningCount;
    fixableErrorCount += result.fixableErrorCount;
    fixableWarningCount += result.fixableWarningCount;

    output += `\n\n${chalk.underline(result.filePath)}\n`;

    output += `${table(
      messages.map(message => {
        let messageType;

        if (message.fatal || message.severity === 2) {
          messageType = chalk.red('error');
          summaryColor = 'red';
        } else {
          messageType = chalk.yellow('warning');
        }

        return [
          '',
          message.line || 0,
          message.column || 0,
          messageType,
          message.message.replace(/([^ ])\.$/u, '$1'),
          chalk.dim(message.ruleId || ''),
        ];
      }),
      {
        align: ['', 'r', 'l'],
        stringLength(str) {
          return stripAnsi(str).length;
        },
      },
    )
      .split('\n')
      .map(el =>
        el.replace(/(\d+)\s+(\d+)/u, (m, p1, p2) => chalk.dim(`${p1}:${p2}`)),
      )
      .join('\n')}`;
  });
  return {
    output,
    errorCount,
    warningCount,
    fixableErrorCount,
    fixableWarningCount,
    summaryColor,
  };
};

const determineFormatterVersion = results =>
  results.some(x => x.version === 'lineOnly') ? 'lineOnly' : 'fullFile';

const getOutput = results => {
  let newLineResults = [];
  let existingResults = [];
  let newLineResultOutput;
  const formatterVersion = determineFormatterVersion(results);
  if (formatterVersion === 'lineOnly') {
    newLineResultOutput = buildResult(results);
  } else {
    results.forEach(x => {
      const newLineMessages = x.messages.filter(x => x.newLineError);
      if (newLineMessages.length) {
        newLineResults.push({ ...x, messages: newLineMessages });
        const existingMessages = x.messages.filter(x => !x.newLineError);
        existingResults.push({ ...x, messages: existingMessages });
      } else {
        existingResults.push(x);
      }
    });
    newLineResultOutput = buildResult(newLineResults);
  }

  const existingResultOutput = buildResult(existingResults);
  let finalOutput;
  const existing = existingResultOutput.output
    ? `\n --------------------------------- \n Existing Lint Errors \n ---------------------------------${existingResultOutput.output} \n\n`
    : '';
  const newLine = newLineResultOutput.output
    ? `\n --------------------------------- \n NEW Lint Errors \n ---------------------------------${newLineResultOutput.output}\n\n`
    : `\n --------------------------------- \n No NEW Lint Errors! Nice. \n ---------------------------------\n\n`;

  if (formatterVersion === 'fullFile') {
    finalOutput = `${existing}${newLine}`;
  } else {
    finalOutput = `${newLineResultOutput.output}\n\n`;
  }

  return {
		errorCount: newLineResultOutput.errorCount || existingResultOutput.errorCount || 0,
    warningCount: newLineResultOutput.warningCount || existingResultOutput.warningCount || 0,
    fixableErrorCount: newLineResultOutput.fixableErrorCount || existingResultOutput.fixableErrorCount || 0,
    fixableWarningCount: newLineResultOutput.fixableWarningCount || existingResultOutput.fixableWarningCount || 0,
    summaryColor:
      existingResultOutput.summaryColor === 'red' ||
      newLineResultOutput.summaryColor === 'red'
        ? 'red'
        : 'yellow',
    output: finalOutput,
  };
};

//------------------------------------------------------------------------------
// Public Interface
//------------------------------------------------------------------------------

module.exports = function (results) {
  const result = getOutput(results);
  const {
    errorCount,
    warningCount,
    fixableErrorCount,
    fixableWarningCount,
    summaryColor,
  } = result;

  let output = result.output || '';
  const total = errorCount + warningCount;

  if (total > 0) {
    output += chalk[summaryColor].bold(
      [
        '\u2716 ',
        total,
        pluralize(' problem', total),
        ' (',
        errorCount,
        pluralize(' error', errorCount),
        ', ',
        warningCount,
        pluralize(' warning', warningCount),
        ')\n',
      ].join(''),
    );

    if (fixableErrorCount > 0 || fixableWarningCount > 0) {
      output += chalk[summaryColor].bold(
        [
          '  ',
          fixableErrorCount,
          pluralize(' error', fixableErrorCount),
          ' and ',
          fixableWarningCount,
          pluralize(' warning', fixableWarningCount),
          ' potentially fixable with the `--fix` option.\n',
        ].join(''),
      );
    }
  }

  // Resets output color, for prevent change on top level
  return total > 0 ? chalk.reset(output) : '';
};
