import parseVelocityHtml from '../../src/parser/parser';

describe('parser', () => {


    const html = `
    <p class="\${classes}">
        Hello, World!
    </p>`

    it('should parser', () => {
        parseVelocityHtml(html);      
    });
  
  });
  