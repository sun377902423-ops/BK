window.config = {
  routerBasename: '/ohif',
  extensions: [],
  modes: [],
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
  defaultDataSourceName: 'Orthanc',
  hotkeys: [],
  ui: {
    viewportCorners: {
      left: ['PatientID'],
      right: ['StudyDate'],
      bottomLeft: ['StudyDescription'],
      bottomRight: ['Modality'],
    },
  },
};
