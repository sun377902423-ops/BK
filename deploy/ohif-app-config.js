window.config = {
  routerBasename: '/ohif',
  showStudyList: false,
  servers: {
    dicomWeb: [
      {
        name: 'Orthanc',
        wadoUriRoot: '/orthanc/wado',
        qidoRoot: '/orthanc/dicom-web',
        wadoRoot: '/orthanc/dicom-web',
        qidoSupportsIncludeField: true,
        imageRendering: 'wadors',
        thumbnailRendering: 'wadors',
        enableStudyLazyLoad: true,
        supportsFuzzyMatching: true,
        supportsWildcard: true,
        omitQuotationForMultipartRequest: true,
      },
    ],
  },
  dataSources: [
    {
      namespace: '@ohif/extension-default.dataSourcesModule.dicomweb',
      sourceName: 'dicomweb',
      configuration: {
        friendlyName: 'Orthanc',
        name: 'Orthanc',
        wadoUriRoot: '/orthanc/wado',
        qidoRoot: '/orthanc/dicom-web',
        wadoRoot: '/orthanc/dicom-web',
        qidoSupportsIncludeField: true,
        imageRendering: 'wadors',
        thumbnailRendering: 'wadors',
        enableStudyLazyLoad: true,
        supportsFuzzyMatching: true,
        supportsWildcard: true,
        omitQuotationForMultipartRequest: true,
        singlepart: 'bulkdata,video,pdf',
      },
    },
  ],
  defaultDataSourceName: 'dicomweb',
  extensions: [],
  modes: [],
  hotkeys: [],
  i18n: {
    languages: [
      {
        code: 'zh',
        label: '中文',
        translations: {
          'OHIF Viewer': 'BK-PACS',
          'Open': '',
          'Research Use': '',
          'Options': '',
        },
      },
      {
        code: 'en',
        label: 'English',
        translations: {
          'OHIF Viewer': 'BK-PACS',
          'Open': '',
          'Research Use': '',
          'Options': '',
        },
      },
    ],
    defaultLanguage: 'zh',
  },
  branding: {
    title: 'BK-PACS',
    logo: null,
  },
};
