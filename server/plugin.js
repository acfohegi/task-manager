// @ts-check

import { fileURLToPath } from 'url';
import path from 'path';
import fastifyStatic from '@fastify/static';
// NOTE: не поддерживает fastify 4.x
// import fastifyErrorPage from 'fastify-error-page';
import fastifyView from '@fastify/view';
import fastifyFormbody from '@fastify/formbody';
import fastifySecureSession from '@fastify/secure-session';
import fastifyPassport from '@fastify/passport';
import fastifySensible from '@fastify/sensible';
import { plugin as fastifyReverseRoutes } from 'fastify-reverse-routes';
import fastifyMethodOverride from 'fastify-method-override';
import fastifyObjectionjs from 'fastify-objectionjs';
import qs from 'qs';
import Pug from 'pug';
import i18next from 'i18next';
import Rollbar from 'rollbar';

import ru from './locales/ru.js';
import en from './locales/en.js';
// @ts-ignore
import addRoutes from './routes/index.js';
import addHelperRoutes from './helpers/addHelperRoutes.js';
import getHelpers from './helpers/index.js';
import * as knexConfig from '../knexfile.js';
import models from './models/index.js';
import FormStrategy from './lib/passportStrategies/FormStrategy.js';
import AccessError from './errors/AccessError.js';

const __dirname = fileURLToPath(path.dirname(import.meta.url));
const mode = process.env.NODE_ENV || 'development';

const setUpViews = (app) => {
  const helpers = getHelpers(app);
  app.register(fastifyView, {
    engine: {
      pug: Pug,
    },
    includeViewExtension: true,
    defaultContext: {
      ...helpers,
      assetPath: (filename) => `/assets/${filename}`,
    },
    templates: path.join(__dirname, '..', 'server', 'views'),
  });

  app.decorateReply('render', function render(viewPath, locals) {
    this.view(viewPath, { ...locals, reply: this });
  });
};

const setUpStaticAssets = (app) => {
  const pathPublic = path.join(__dirname, '..', 'dist');
  app.register(fastifyStatic, {
    root: pathPublic,
    prefix: '/assets/',
  });
};

const setupLocalization = async () => {
  await i18next
    .init({
      lng: 'ru',
      fallbackLng: 'en',
      debug: mode !== 'production',
      resources: {
        ru,
        en,
      },
    });
};

const rollbar = new Rollbar({
  accessToken: process.env.ROLLBAR_TOKEN,
  captureUncaught: true,
  captureUnhandledRejections: true,
});

const addHooks = (app) => {
  app.addHook('preHandler', async (req, reply) => {
    reply.locals = {
      isAuthenticated: () => req.isAuthenticated(),
    };
  });
  app.addHook('onError', async (req, reply, e) => {
    app.log.error(e, req, reply);
    if (mode === 'production') {
      rollbar.error(e, req);
    }
  });
};

const registerPlugins = async (app) => {
  await app.register(fastifySensible);
  // await app.register(fastifyErrorPage);
  await app.register(fastifyReverseRoutes);
  await app.register(fastifyFormbody, { parser: qs.parse });
  await app.register(fastifySecureSession, {
    secret: process.env.SESSION_KEY,
    cookie: {
      path: '/',
    },
  });

  fastifyPassport.registerUserDeserializer(
    (user) => app.objection.models.user.query().findById(user.id),
  );
  fastifyPassport.registerUserSerializer((user) => Promise.resolve(user));
  fastifyPassport.use(new FormStrategy('form', app));
  await app.register(fastifyPassport.initialize());
  await app.register(fastifyPassport.secureSession());
  await app.decorate('fp', fastifyPassport);
  app.decorate('authenticate', (...args) => fastifyPassport.authenticate(
    'form',
    {
      failureRedirect: app.reverse('root'),
      failureFlash: i18next.t('flash.authError'),
    },
  // @ts-ignore
  )(...args));
  app.decorateRequest('isPermitted', function () {
    if (!this.isAuthenticated()) {
      throw new AccessError(i18next.t('flash.authError'));
    }
  });

  await app.register(fastifyMethodOverride);
  await app.register(fastifyObjectionjs, {
    knexConfig: knexConfig[mode],
    models,
  });
};

export const options = {
  exposeHeadRoutes: false,
};

// eslint-disable-next-line no-unused-vars
export default async (app, _options) => {
  await registerPlugins(app);

  await setupLocalization();
  setUpViews(app);
  setUpStaticAssets(app);
  addRoutes(app);
  addHooks(app);

  if (mode !== 'production') {
    addHelperRoutes(app);
  }

  return app;
};
