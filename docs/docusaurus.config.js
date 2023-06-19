const { themes } = require('prism-react-renderer');

/** @type {import('@docusaurus/types').Config} */
const config = {
  title: 'Comparadise',
  tagline:
    'A visual comparison tool for reviewing visual changes on frontend pull requests',
  favicon: 'img/island.svg',

  url: 'https://expediagroup.github.io',
  baseUrl: '/comparadise/',

  organizationName: 'ExpediaGroup',
  projectName: 'comparadise',

  onBrokenLinks: 'throw',
  onBrokenMarkdownLinks: 'warn',

  presets: [
    [
      'classic',
      /** @type {import('@docusaurus/preset-classic').Options} */
      ({
        docs: {
          sidebarPath: require.resolve('./sidebars.js'),
        },
        theme: {
          customCss: require.resolve('./src/css/custom.css'),
        },
      }),
    ],
  ],

  themeConfig:
    /** @type {import('@docusaurus/preset-classic').ThemeConfig} */
    ({
      navbar: {
        title: 'Comparadise',
        logo: {
          alt: 'Island',
          src: 'img/island.svg',
        },
        items: [
          {
            type: 'docSidebar',
            sidebarId: 'docsSidebar',
            position: 'left',
            label: 'Docs',
          },
          {
            type: 'html',
            position: 'right',
            className: 'header-release-link',
            value: '<a href="https://github.com/ExpediaGroup/comparadise/releases/latest"><img alt="latest-release" src="https://img.shields.io/github/v/release/ExpediaGroup/comparadise"/></a>'
          },
          {
            href: 'https://github.com/ExpediaGroup/comparadise',
            className: 'header-github-link',
            position: 'right',
          },
        ],
      },
      footer: {
        style: 'dark',
        copyright: `Copyright © ${new Date().getFullYear()} Expedia, Inc.`,
      }
    }),
};

module.exports = config;
