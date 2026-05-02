import { Test, TestingModule } from '@nestjs/testing';
import { OfficerController } from './officer.controller';

describe('OfficerController', () => {
  let controller: OfficerController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [OfficerController],
    }).compile();

    controller = module.get<OfficerController>(OfficerController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
