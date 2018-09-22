const expect = require('chai').expect;
const fs = require('fs');
const path = require('path');
const validate = require('../src/validate');

describe('Page validation parser', function() {
  it('test null validation', () => {
    const result = validate.validateHtml();
    expect(result).to.be.not.empty;
  });

  it('test empty validation', () => {
    const result = validate.validateHtml('');
    expect(result).to.be.not.empty;
  });

  it('test with blank file', () => {
    const outputFile = path.resolve(__dirname, 'files/blank.html');

    // Read the contents
    const data = fs.readFileSync(outputFile, {
      encoding: 'utf8'
    });

    const result = validate.validateHtml(data);
    expect(result).to.be.not.empty;
  });

  it('test with HTML file', () => {
    const outputFile = path.resolve(__dirname, 'files/page.html');

    // Read the contents
    const data = fs.readFileSync(outputFile, {
      encoding: 'utf8'
    });

    const result = validate.validateHtml(data);
    expect(result).to.be.null;
  });
});
