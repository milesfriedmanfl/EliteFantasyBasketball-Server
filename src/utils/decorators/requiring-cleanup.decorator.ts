export const CLASS_REQUIRING_CLEANUP = 'CLASS_REQUIRING_CLEANUP';

export const RequiresCleanup = (): ClassDecorator => {
    return (classToDecorate) => {
        Reflect.defineMetadata(CLASS_REQUIRING_CLEANUP, true, classToDecorate);
    };
};