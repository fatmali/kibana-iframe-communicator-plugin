


export default function (kibana) {
  return new kibana.Plugin({
    require: ['elasticsearch'],
    name: 'kibana-iframe-communicator-plugin',
    uiExports: {
      hacks: [
        'plugins/kibana-iframe-communicator-plugin/hack'
      ]
    },

    config(Joi) {
      return Joi.object({
        enabled: Joi.boolean().default(true),
      }).default();
    },

  });
};
