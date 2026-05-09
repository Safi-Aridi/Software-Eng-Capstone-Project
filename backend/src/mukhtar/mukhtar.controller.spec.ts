import { Test, TestingModule } from '@nestjs/testing';
import { MukhtarController } from './mukhtar.controller';

describe('MukhtarController', () => {
  let controller: MukhtarController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MukhtarController],
    }).compile();

    controller = module.get<MukhtarController>(MukhtarController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
