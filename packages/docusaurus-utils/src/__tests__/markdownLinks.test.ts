/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {describe, expect, it} from 'vitest';
import {resolveMarkdownLinkPathname} from '../markdownLinks';

describe('resolveMarkdownLinkPathname', () => {
  type Context = Parameters<typeof resolveMarkdownLinkPathname>[1];

  it('does basic replace', () => {
    const context: Context = {
      siteDir: '.',
      sourceFilePath: 'docs/intro.md',
      contentPaths: {
        contentPath: 'docs',
        contentPathLocalized: 'i18n/docs-localized',
      },
      sourceToPermalink: new Map(
        Object.entries({
          '@site/docs/intro.md': '/docs/intro',
          '@site/docs/foo.md': '/doc/foo',
          '@site/docs/bar/baz.md': '/doc/baz',
          '@site/docs/http.foo.md': '/doc/http',
        }),
      ),
    };

    function test(linkPathname: string, expectedOutput: string) {
      const output = resolveMarkdownLinkPathname(linkPathname, context);
      expect(output).toEqual(expectedOutput);
    }

    test('./foo.md', '/doc/foo');
    test('foo.md', '/doc/foo');
    test('./bar/baz.md', '/doc/baz');
    test('http.foo.md', '/doc/http');
    test('@site/docs/_partial.md', null);
    test('foo.js', null);
    test('nonexistent.md', null);
    test('https://github.com/facebook/docusaurus/README.md', null);
  });

  it('resolves absolute and relative links differently', () => {
    const context: Context = {
      siteDir: '.',
      sourceFilePath: 'docs/intro/intro.md',
      contentPaths: {
        contentPath: 'docs',
        contentPathLocalized: 'i18n/docs-localized',
      },

      sourceToPermalink: new Map(
        Object.entries({
          '@site/docs/intro/intro.md': '/docs/intro',
          '@site/docs/intro/another.md': '/docs/another',
          '@site/docs/api/classes/divine_uri.URI.md': '/docs/api/classes/uri',
        }),
      ),
    };

    function test(linkPathname: string, expectedOutput: string) {
      const output = resolveMarkdownLinkPathname(linkPathname, context);
      expect(output).toEqual(expectedOutput);
    }

    test('./another.md', '/docs/another');
    test('../api/classes/divine_uri.URI.md', '/docs/api/classes/uri');
    test('./api/classes/divine_uri.URI.md', null);
    test('/api/classes/divine_uri.URI.md', '/docs/api/classes/uri');
    test('/docs/api/classes/divine_uri.URI.md', '/docs/api/classes/uri');
    test('/another.md', null);
    test('api/classes/divine_uri.URI.md', '/docs/api/classes/uri');
    test('another.md', '/docs/another');
  });

  it('uses relative file paths in priority - Fix #11099', () => {
    // Unit test to fix bug https://github.com/facebook/docusaurus/issues/11099

    const context: Context = {
      siteDir: '.',
      sourceFilePath: 'docs/test/file.mdx',
      contentPaths: {
        contentPath: 'docs',
        contentPathLocalized: 'i18n/docs-localized',
      },
      sourceToPermalink: new Map(
        Object.entries({
          '@site/docs/file.mdx': '/docs/file',
          '@site/docs/test/file.mdx': '/docs/test/file',
        }),
      ),
    };

    function test(linkPathname: string, expectedOutput: string) {
      const output = resolveMarkdownLinkPathname(linkPathname, context);
      expect(output).toEqual(expectedOutput);
    }

    test('./file.mdx', '/docs/test/file');
    test('file.mdx', '/docs/test/file');
  });

  describe('partially translated content - Fix #10907', () => {
    // Unit tests to fix bug https://github.com/facebook/docusaurus/issues/10907
    // A translated file is only present in sourceToPermalink under its
    // localized source path

    const contentPaths: Context['contentPaths'] = {
      contentPath: 'docs',
      contentPathLocalized: 'i18n/docs-localized',
    };

    const sourceToPermalink: Context['sourceToPermalink'] = new Map(
      Object.entries({
        '@site/docs/untranslated.md': '/docs/untranslated',
        '@site/docs/basics/untranslated.md': '/docs/basics/untranslated',
        '@site/docs/extras/untranslated.md': '/docs/extras/untranslated',
        '@site/i18n/docs-localized/translated.md': '/docs/translated',
        '@site/i18n/docs-localized/extras/translated.md':
          '/docs/extras/translated',
      }),
    );

    function createTest(sourceFilePath: string) {
      const context: Context = {
        siteDir: '.',
        sourceFilePath,
        contentPaths,
        sourceToPermalink,
      };
      return (linkPathname: string, expectedOutput: string | null) => {
        const output = resolveMarkdownLinkPathname(linkPathname, context);
        expect(output).toEqual(expectedOutput);
      };
    }

    it('resolves links from untranslated to translated file', () => {
      const test = createTest('docs/basics/untranslated.md');

      test('../extras/translated.md', '/docs/extras/translated');
      test('../translated.md', '/docs/translated');
      test('./../extras/translated.md', '/docs/extras/translated');
      test('../extras/nonexistent.md', null);
    });

    it('resolves links from translated to untranslated file', () => {
      const test = createTest('i18n/docs-localized/extras/translated.md');

      test('../basics/untranslated.md', '/docs/basics/untranslated');
      test('../untranslated.md', '/docs/untranslated');
      test('./untranslated.md', '/docs/extras/untranslated');
      test('./nonexistent.md', null);
    });

    it('resolves sibling links between untranslated and translated files', () => {
      createTest('docs/extras/untranslated.md')(
        './translated.md',
        '/docs/extras/translated',
      );
      createTest('docs/extras/untranslated.md')(
        'translated.md',
        '/docs/extras/translated',
      );
      createTest('i18n/docs-localized/extras/translated.md')(
        'untranslated.md',
        '/docs/extras/untranslated',
      );
      createTest('i18n/docs-localized/translated.md')(
        'untranslated.md',
        '/docs/untranslated',
      );
    });

    it('uses the current file dir in priority', () => {
      const context: Context = {
        siteDir: '.',
        sourceFilePath: 'i18n/docs-localized/test/source.mdx',
        contentPaths,
        sourceToPermalink: new Map(
          Object.entries({
            '@site/docs/file.mdx': '/docs/file',
            '@site/docs/test/file.mdx': '/docs/test/file',
            '@site/i18n/docs-localized/test/file.mdx':
              '/docs/test/file-localized',
            '@site/docs/test/other.mdx': '/docs/test/other',
            '@site/i18n/docs-localized/other.mdx': '/docs/other-localized',
          }),
        ),
      };

      function test(linkPathname: string, expectedOutput: string) {
        const output = resolveMarkdownLinkPathname(linkPathname, context);
        expect(output).toEqual(expectedOutput);
      }

      test('./file.mdx', '/docs/test/file-localized');
      test('file.mdx', '/docs/test/file-localized');
      // The equivalent dir is tried before the plugin content paths
      test('other.mdx', '/docs/test/other');
    });
  });

  it('can resolve @site/ links', () => {
    const context: Context = {
      siteDir: '.',
      sourceFilePath: 'docs/test/file.mdx',
      contentPaths: {
        contentPath: 'docs',
        contentPathLocalized: 'i18n/docs-localized',
      },
      sourceToPermalink: new Map(
        Object.entries({
          '@site/docs/file.mdx': '/docs/file',
          '@site/docs/dir with spaces/file.mdx': '/docs/dir-with-spaces/file',
        }),
      ),
    };

    function test(linkPathname: string, expectedOutput: string) {
      const output = resolveMarkdownLinkPathname(linkPathname, context);
      expect(output).toEqual(expectedOutput);
    }

    test('@site/docs/file.mdx', '/docs/file');
    test('@site/docs/dir with spaces/file.mdx', '/docs/dir-with-spaces/file');
    test(
      '@site/docs/dir%20with%20spaces/file.mdx',
      '/docs/dir-with-spaces/file',
    );
  });
});
