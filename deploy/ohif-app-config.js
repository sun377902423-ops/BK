window.config = {
  routerBasename: '/ohif',
  showStudyList: false,
  dataSources: [
    {
      sourceName: 'dicomweb',
      namespace: '@ohif/extension-default.dataSourcesModule.dicomweb',
      configuration: {
        friendlyName: 'Orthanc DICOMweb',
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
    },
  ],
  defaultDataSourceName: 'dicomweb',
  hotkeys: [],
};
